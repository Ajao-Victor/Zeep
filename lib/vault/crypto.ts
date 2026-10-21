import { b64, fromB64, utf8, zero } from "@/lib/bytes";
import type { CipherBlob } from "@/lib/vault/types";

export async function importAes(raw: Uint8Array): Promise<CryptoKey> {
  const copy = new Uint8Array(raw);
  try {
    return await crypto.subtle.importKey("raw", copy, { name: "AES-GCM" }, false, [
      "encrypt",
      "decrypt",
    ]);
  } finally {
    zero(copy);
  }
}

export async function encryptBytes(key: CryptoKey, bytes: Uint8Array): Promise<CipherBlob> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, bytes as BufferSource));
  return { iv: b64(iv), ct: b64(cipher) };
}

export async function decryptBytes(key: CryptoKey, blob: CipherBlob): Promise<Uint8Array> {
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromB64(blob.iv) as BufferSource },
    key,
    fromB64(blob.ct) as BufferSource,
  );
  return new Uint8Array(plain);
}

export async function encryptJson(key: CryptoKey, value: unknown): Promise<CipherBlob> {
  return encryptBytes(key, utf8(JSON.stringify(value)));
}

export async function decryptJson<T>(key: CryptoKey, blob: CipherBlob): Promise<T> {
  const plain = await decryptBytes(key, blob);
  try {
    return JSON.parse(new TextDecoder().decode(plain)) as T;
  } finally {
    zero(plain);
  }
}
