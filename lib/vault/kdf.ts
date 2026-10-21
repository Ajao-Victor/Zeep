import { config } from "@/lib/config";
import { zero } from "@/lib/bytes";

export async function derivePinBits(pin: string, salt: Uint8Array): Promise<Uint8Array> {
  const worker = new Worker(new URL("../../workers/kdf.worker.ts", import.meta.url), {
    type: "module",
  });
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
