import { bytesToHex, concatBytes, hexToBytes } from "@noble/hashes/utils";
import { sha256 } from "@noble/hashes/sha256";

export function utf8(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

export function hex(bytes: Uint8Array): string {
  return bytesToHex(bytes);
}

export function fromHex(value: string): Uint8Array {
  return hexToBytes(value);
}

export function concat(...parts: Uint8Array[]): Uint8Array {
  return concatBytes(...parts);
}

export function sha256Hex(bytes: Uint8Array): string {
  return bytesToHex(sha256(bytes));
}

export function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

export function b64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function fromB64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function b64url(bytes: Uint8Array): string {
  return b64(bytes).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export function zero(bytes: Uint8Array | null | undefined) {
  bytes?.fill(0);
}

export function u32(value: number): Uint8Array {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value);
  return bytes;
}
