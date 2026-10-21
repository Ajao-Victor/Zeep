import { FundsError } from "@/lib/zeep/pay";

type Chunk = { choices?: { delta?: { content?: string } }[] };

/** OpenAI-style SSE. Lines that start with ":" are heartbeats. */
export async function readSse(response: Response, onDelta: (text: string) => void): Promise<void> {
  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => "");
    let message = `The API returned ${response.status}.`;
    let code = "";
    try {
      const json = JSON.parse(text) as { error?: { message?: string; code?: string } | string };
      if (typeof json.error === "string") message = json.error;
      else if (json.error?.message) {
        message = json.error.message;
        code = json.error.code ?? "";
      }
    } catch {
      if (text) message = text.slice(0, 180);
    }
    if (response.status === 402 || code === "insufficient") throw new FundsError(message);
    throw new Error(message);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(":")) continue;
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      const json = JSON.parse(data) as Chunk;
      const text = json.choices?.[0]?.delta?.content ?? "";
      if (text) onDelta(text);
    }
  }
}
