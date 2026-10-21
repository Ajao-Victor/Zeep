import type { Network } from "@/lib/config";
import { readDeviceFile } from "@/lib/chat/blobs";
import type { Attachment, ChatMessage, ContentPart, FileRef, TextPart } from "@/lib/chat/types";

const TEXT_EXT = /\.(txt|md|csv|json|js|jsx|ts|tsx|py|rs|go|rb|java|c|h|css|html|yml|yaml|toml|sh)$/i;

export function fileKind(file: File): Attachment["kind"] | null {
  if (file.type.startsWith("image/")) return "image";
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) return "pdf";
  if (file.type.startsWith("text/") || TEXT_EXT.test(file.name)) return "text";
  return null;
}

async function scaled(file: File, maxEdge: number, quality: number): Promise<{ bytes: Uint8Array; url: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot prepare that image.");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => (result ? resolve(result) : reject(new Error("This browser cannot prepare that image."))), "image/jpeg", quality);
  });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return { bytes, url: URL.createObjectURL(blob) };
}

async function pdfText(data: ArrayBuffer): Promise<string> {
  const pdfjs = (await import("pdfjs-dist")) as unknown as {
    GlobalWorkerOptions: { workerSrc: string };
    getDocument: (src: { data: Uint8Array }) => { promise: Promise<{ numPages: number; getPage: (n: number) => Promise<{ getTextContent: () => Promise<{ items: { str?: string }[] }> }> }> };
  };
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  }
  const doc = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => item.str ?? "").join(" "));
  }
  return pages.join("\n\n");
}

export async function readAttachment(file: File): Promise<Attachment> {
  const kind = fileKind(file);
  if (!kind) throw new Error(`${file.name} is not an image, a text file, or a PDF.`);
  if (kind === "image") {
    const image = await scaled(file, 2048, 0.85);
    const thumb = await scaled(file, 256, 0.7);
    URL.revokeObjectURL(thumb.url);
    return {
      id: crypto.randomUUID(),
      name: file.name || "photo.jpg",
      size: image.bytes.byteLength,
      mime: "image/jpeg",
      kind,
      bytes: image.bytes,
      thumb: thumb.bytes,
      previewUrl: image.url,
    };
  }
  if (kind === "pdf") {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const text = await pdfText(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
    return { id: crypto.randomUUID(), name: file.name, size: file.size, mime: file.type || "application/pdf", kind, text, bytes };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  return { id: crypto.randomUUID(), name: file.name, size: file.size, mime: file.type || "text/plain", kind, text: await file.text(), bytes };
}

function dataUrl(bytes: Uint8Array, mime: string): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

/** Turn stored file references into the parts the paid request actually sends. */
export async function expandMessages(network: Network, vaultKey: Uint8Array, messages: ChatMessage[]): Promise<{ role: ChatMessage["role"]; content: string | ContentPart[] }[]> {
  const out: { role: ChatMessage["role"]; content: string | ContentPart[] }[] = [];
  for (const message of messages) {
    if (!Array.isArray(message.content)) {
      out.push({ role: message.role, content: message.content });
      continue;
    }
    const parts: ContentPart[] = [];
    for (const part of message.content) {
      if (part.type !== "file") {
        parts.push(part);
        continue;
      }
      const file = await readDeviceFile(network, vaultKey, part.id);
      if (!file) {
        parts.push({ type: "text", text: `${part.mime.startsWith("image/") ? "Image" : "File"} (${part.name}) is on another device` });
        continue;
      }
      if (file.meta.text) {
        parts.push({ type: "text", text: `File: ${part.name}\n${file.meta.text}` });
      } else if (part.mime.startsWith("image/")) {
        parts.push({ type: "image_url", image_url: { url: dataUrl(file.bytes, part.mime) } });
      } else {
        const text = new TextDecoder().decode(file.bytes);
        parts.push({ type: "text", text: `File: ${part.name}\n${text}` });
      }
    }
    out.push({ role: message.role, content: parts });
  }
  return out;
}

export function storedParts(text: string, attachments: { id: string; name: string; mime: string; size: number; kind: string; text?: string }[]): ContentPart[] {
  const parts: ContentPart[] = [];
  if (text.trim()) parts.push({ type: "text", text: text.trim() });
  for (const item of attachments) {
    if (item.kind === "image") {
      parts.push({ type: "file", id: item.id, name: item.name, mime: item.mime, size: item.size } satisfies FileRef);
    } else if (item.text) {
      parts.push({ type: "file", id: item.id, name: item.name, mime: item.mime, size: item.size });
    }
  }
  if (!parts.length) throw new Error("Write a message or attach a file.");
  return parts;
}

export function textOfFile(item: { kind: string; text?: string; name: string }): TextPart | null {
  if (item.kind === "image" || !item.text) return null;
  return { type: "text", text: `File: ${item.name}\n${item.text}` };
}
