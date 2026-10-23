import { config } from "@/lib/config";
import { zero } from "@/lib/bytes";

/** "start" when Argon2id begins in the worker, "end" when it finishes (derived or failed). */
export type KdfEvent = "start" | "end";

const listeners = new Set<(event: KdfEvent) => void>();

/**
 * Subscribe to the real Argon2id start and end edges (the Vault Door listens here). Every PIN
 * derivation emits: unlock, create, restore and reauth. Returns the unsubscribe.
 */
export function onKdf(listener: (event: KdfEvent) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit(event: KdfEvent) {
  for (const listener of [...listeners]) listener(event);
}

export async function derivePinBits(pin: string, salt: Uint8Array): Promise<Uint8Array> {
  const worker = new Worker(new URL("../../workers/kdf.worker.ts", import.meta.url), {
    type: "module",
  });
  // Only once the worker exists, so every "start" is paired with the "end" in the finally below.
  emit("start");
  const id = crypto.randomUUID();
  try {
    const hash = await new Promise<Uint8Array>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Key derivation timed out")), 120_000);
      worker.onmessage = (event: MessageEvent<{ id: string; hash?: ArrayBuffer; error?: string }>) => {
        if (event.data.id !== id) return;
        clearTimeout(timer);
        if (event.data.error || !event.data.hash) {
          reject(new Error(event.data.error || "Key derivation failed"));
          return;
        }
        resolve(new Uint8Array(event.data.hash));
      };
      worker.onerror = () => {
        clearTimeout(timer);
        reject(new Error("Key derivation failed"));
      };
      worker.postMessage({
        id,
        pin,
        salt,
        memorySize: config.argon2MemoryKib,
        iterations: config.argon2Passes,
      });
    });
    return hash;
  } finally {
    worker.terminate();
    emit("end");
  }
}

export async function derivePinKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const bits = await derivePinBits(pin, salt);
  try {
    const { importAes } = await import("@/lib/vault/crypto");
    return await importAes(bits);
  } finally {
    zero(bits);
  }
}
