import type { MeteredRate } from "@/lib/zeep/prices";

export type ApiChatMessage = {
  role: string;
  content: string | { type: string; text?: string }[];
};

const utf8Len = (value: string): number => new TextEncoder().encode(value).length;

/** Same input-token estimate the server uses before it accepts a chat payment. */
export function inputTokens(messages: ApiChatMessage[], rate: Pick<MeteredRate, "bytes_per_token" | "image_tokens" | "message_tokens">): number {
  let text = 0;
  let images = 0;
  for (const message of messages) {
    if (typeof message.content === "string") text += utf8Len(message.content);
    else {
      for (const part of message.content) {
        if (part.type === "text") text += utf8Len(part.text ?? "");
        else images += 1;
      }
    }
  }
  return Math.ceil(text / rate.bytes_per_token) + images * rate.image_tokens + messages.length * rate.message_tokens;
}

export function outputCap(rate: Pick<MeteredRate, "default_output" | "max_output">, requested?: number): number {
  return Math.min(requested ?? rate.default_output, rate.max_output);
}

/** How many input tokens fit once the output cap is reserved. Null when the sheet has no context size. */
export function maxInputTokens(rate: MeteredRate, requested?: number): number | null {
  if (rate.context == null || rate.context <= 0) return null;
  return Math.max(0, rate.context - outputCap(rate, requested));
}

/**
 * Drop the oldest messages until the input fits. System messages stay, and so does the newest
 * message. Returns null when the newest message still does not fit.
 */
export function fitContext(
  messages: ApiChatMessage[],
  rate: Pick<MeteredRate, "bytes_per_token" | "image_tokens" | "message_tokens">,
  maxInput: number,
): { messages: ApiChatMessage[]; dropped: number } | null {
  const next = messages.slice();
  let dropped = 0;
  while (inputTokens(next, rate) > maxInput) {
    const index = next.findIndex((message, i) => message.role !== "system" && i < next.length - 1);
    if (index < 0) return null;
    next.splice(index, 1);
    dropped += 1;
  }
  return { messages: next, dropped };
}
