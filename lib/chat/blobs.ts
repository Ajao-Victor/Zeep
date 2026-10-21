import type { Network } from "@/lib/config";
import { b64, fromB64, utf8 } from "@/lib/bytes";
import { kvDel, kvGet, kvSet, storeKey } from "@/lib/vault/db";
import { decryptBytes, encryptBytes, importAes } from "@/lib/vault/crypto";
import type { CipherBlob } from "@/lib/vault/types";
import type { ChatMessage, FileRef } from "@/lib/chat/types";
import { zipStored } from "@/lib/chat/zip";

type FileMeta = { name: string; mime: string; size: number; chatId: string; text?: string };

async function keyOf(vaultKey: Uint8Array) {
  return importAes(vaultKey);
}

export async function saveDeviceFile(
  network: Network,
  vaultKey: Uint8Array,
  file: { id: string; name: string; mime: string; size: number; chatId: string; bytes: Uint8Array; thumb?: Uint8Array; text?: string },
): Promise<FileRef> {
  const key = await keyOf(vaultKey);
  const meta: FileMeta = { name: file.name, mime: file.mime, size: file.size, chatId: file.chatId, text: file.text };
  await kvSet(storeKey.file(network, file.id), await encryptBytes(key, utf8(JSON.stringify(meta))));
  await kvSet(storeKey.fileBytes(network, file.id), await encryptBytes(key, file.bytes));
  if (file.thumb) await kvSet(storeKey.thumb(network, file.id), await encryptBytes(key, file.thumb));
  const ids = (await kvGet<string[]>(storeKey.fileIds(network))) ?? [];
  if (!ids.includes(file.id)) await kvSet(storeKey.fileIds(network), [...ids, file.id]);
  return { type: "file", id: file.id, name: file.name, mime: file.mime, size: file.size };
}

export async function readDeviceFile(network: Network, vaultKey: Uint8Array, id: string): Promise<{ meta: FileMeta; bytes: Uint8Array } | null> {
  const metaBlob = await kvGet<CipherBlob>(storeKey.file(network, id));
  const byteBlob = await kvGet<CipherBlob>(storeKey.fileBytes(network, id));
  if (!metaBlob || !byteBlob) return null;
  const key = await keyOf(vaultKey);
  const meta = JSON.parse(new TextDecoder().decode(await decryptBytes(key, metaBlob))) as FileMeta;
  const bytes = await decryptBytes(key, byteBlob);
  return { meta, bytes };
}

export async function readThumbUrl(network: Network, vaultKey: Uint8Array, id: string): Promise<string | null> {
  const blob = await kvGet<CipherBlob>(storeKey.thumb(network, id));
  if (!blob) return null;
  const bytes = await decryptBytes(await keyOf(vaultKey), blob);
  return URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "image/jpeg" }));
}

export async function fileCount(network: Network): Promise<number> {
  return ((await kvGet<string[]>(storeKey.fileIds(network))) ?? []).length;
}

export async function deleteDeviceFiles(network: Network, ids: string[]): Promise<void> {
  const current = new Set((await kvGet<string[]>(storeKey.fileIds(network))) ?? []);
  await Promise.all(
    ids.flatMap((id) => {
      current.delete(id);
      return [kvDel(storeKey.file(network, id)), kvDel(storeKey.fileBytes(network, id)), kvDel(storeKey.thumb(network, id))];
    }),
  );
  await kvSet(storeKey.fileIds(network), [...current]);
}

export async function deleteAllDeviceFiles(network: Network): Promise<void> {
  const ids = (await kvGet<string[]>(storeKey.fileIds(network))) ?? [];
  await deleteDeviceFiles(network, ids);
}

export async function downloadAllFiles(network: Network, vaultKey: Uint8Array): Promise<void> {
  const ids = (await kvGet<string[]>(storeKey.fileIds(network))) ?? [];
  const files: { name: string; data: Uint8Array }[] = [];
  const used = new Set<string>();
  for (const id of ids) {
    const file = await readDeviceFile(network, vaultKey, id);
    if (!file) continue;
    let name = file.meta.name || id;
    if (used.has(name)) name = `${id.slice(0, 8)}-${name}`;
    used.add(name);
    files.push({ name, data: file.bytes });
  }
  if (!files.length) return;
  const { saveBlob } = await import("@/lib/chat/zip");
  saveBlob(zipStored(files), "zeep-files.zip");
}

export function fileRefs(content: ChatMessage["content"]): FileRef[] {
  if (!Array.isArray(content)) return [];
  return content.filter((part): part is FileRef => part.type === "file");
}

export async function bytesForShare(network: Network, vaultKey: Uint8Array, id: string): Promise<{ name: string; mime: string; bytes: Uint8Array } | null> {
  const file = await readDeviceFile(network, vaultKey, id);
  if (!file) return null;
  return { name: file.meta.name, mime: file.meta.mime, bytes: file.bytes };
}

export function b64Bytes(bytes: Uint8Array): string {
  return b64(bytes);
}

export function bytesFromB64(value: string): Uint8Array {
  return fromB64(value);
}
