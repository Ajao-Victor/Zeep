export type TextPart = { type: "text"; text: string };
export type ImagePart = { type: "image_url"; image_url: { url: string } };
export type ContentPart = TextPart | ImagePart;

export type ChatMessage = {
  role: "user" | "assistant";
  content: string | ContentPart[];
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
  kind: "image" | "text" | "pdf";
  text?: string;
  dataUrl?: string;
};

export const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export function messageText(message: ChatMessage): string {
  if (typeof message.content === "string") return message.content;
  return message.content
    .filter((part): part is TextPart => part.type === "text")
    .map((part) => part.text)
    .join("\n");
}

export function titleFrom(message: ChatMessage): string {
  const text = messageText(message).replace(/^File: .+\n?/, "").trim();
  return (text || "New chat").slice(0, 64);
}
