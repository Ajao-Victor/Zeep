import { config } from "@/lib/config";

export async function copyText(text: string, secret = false): Promise<void> {
  await navigator.clipboard.writeText(text);
  if (!secret) return;
  const snapshot = text;
  window.setTimeout(() => {
    navigator.clipboard
      .readText()
      .then((current) => {
        if (current === snapshot) return navigator.clipboard.writeText("");
        return undefined;
      })
      .catch(() => undefined);
  }, config.clipboardClearSec * 1000);
}
