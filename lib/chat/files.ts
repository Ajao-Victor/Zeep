import type { Attachment, ContentPart } from "@/lib/chat/types";

const TEXT_EXT = /\.(txt|md|csv|json|js|jsx|ts|tsx|py|rs|go|rb|java|c|h|css|html|yml|yaml|toml|sh)$/i;

export function fileKind(file: File): Attachment["kind"] | null {
  if (/^image\/(png|jpeg|webp|gif)$/.test(file.type)) return "image";
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) return "pdf";
  if (file.type.startsWith("text/") || TEXT_EXT.test(file.name)) return "text";
  return null;
}

async function downscale(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const maxEdge = 1600;
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot prepare that image.");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.85);
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
    return { id: crypto.randomUUID(), name: file.name, size: file.size, kind, dataUrl: await downscale(file) };
  }
  if (kind === "pdf") {
    const text = await pdfText(await file.arrayBuffer());
    return { id: crypto.randomUUID(), name: file.name, size: file.size, kind, text };
  }
  return { id: crypto.randomUUID(), name: file.name, size: file.size, kind, text: await file.text() };
}

export function partsFrom(text: string, attachments: Attachment[], vision: boolean): ContentPart[] {
  if (attachments.some((item) => item.kind === "image") && !vision) {
    throw new Error("This model does not read images.");
  }
  const parts: ContentPart[] = [];
  if (text.trim()) parts.push({ type: "text", text: text.trim() });
  for (const item of attachments) {
    if (item.kind === "image" && item.dataUrl) {
      parts.push({ type: "image_url", image_url: { url: item.dataUrl } });
    } else if (item.text) {
      parts.push({ type: "text", text: `File: ${item.name}\n${item.text}` });
    }
  }
  if (!parts.length) throw new Error("Write a message or attach a file.");
  return parts;
}
