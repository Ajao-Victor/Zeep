export type TextPart = { type: "text"; text: string };
export type ImagePart = { type: "image_url"; image_url: { url: string } };
export type FileRef = { type: "file"; id: string; name: string; mime: string; size: number };
export type ContentPart = TextPart | ImagePart | FileRef;

export type ChatMessage = {
  role: "user" | "assistant";
  content: string | ContentPart[];
  model?: string;
};

export type Chat = {
  id: string;
  title: string;
  model: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
};

export type ChatPrefs = {
  autodelete: boolean;
  sync: boolean;
};

export type Attachment = {
  id: string;
  name: string;
  size: number;
  mime: string;
  kind: "image" | "text" | "pdf";
  text?: string;
  bytes?: Uint8Array;
  thumb?: Uint8Array;
  previewUrl?: string;
};

export const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export function messageText(message: ChatMessage): string {
  if (typeof message.content === "string") return message.content;
  return message.content
    .map((part) => (part.type === "text" ? part.text : part.type === "file" ? part.name : ""))
    .filter(Boolean)
    .join("\n");
}

export function fileIdsIn(chat: { messages: ChatMessage[] }): string[] {
  const ids: string[] = [];
  for (const message of chat.messages) {
    if (!Array.isArray(message.content)) continue;
    for (const part of message.content) {
      if (part.type === "file") ids.push(part.id);
    }
  }
  return ids;
}

export function titleFrom(message: ChatMessage): string {
  const text = messageText(message).replace(/^File: .+\n?/, "").trim();
  return (text || "New chat").slice(0, 64);
}
