import { b64, fromB64, utf8 } from "@/lib/bytes";
import { config, type Network } from "@/lib/config";
import { kvDel, kvGet, kvSet, storeKey } from "@/lib/vault/db";
import { importAes } from "@/lib/vault/crypto";
import type { Chat, ChatPrefs } from "@/lib/chat/types";
import { THIRTY_DAYS_MS } from "@/lib/chat/types";

async function seal(vaultKey: Uint8Array, chat: Chat): Promise<string> {
  const key = await importAes(vaultKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, utf8(JSON.stringify(chat)) as BufferSource),
  );
  const packed = new Uint8Array(iv.length + cipher.length);
  packed.set(iv, 0);
  packed.set(cipher, iv.length);
  return b64(packed);
}

async function open(vaultKey: Uint8Array, blob: string): Promise<Chat> {
  const packed = fromB64(blob);
  const key = await importAes(vaultKey);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: packed.slice(0, 12) as BufferSource },
    key,
    packed.slice(12) as BufferSource,
  );
  return JSON.parse(new TextDecoder().decode(plain)) as Chat;
}

export async function readChatPrefs(network: Network): Promise<ChatPrefs> {
  const stored = await kvGet<ChatPrefs>(storeKey.chatPrefs(network));
  return stored ?? { autodelete: config.chatAutodeleteDefault, sync: config.chatSyncDefault };
}

export async function writeChatPrefs(network: Network, prefs: ChatPrefs): Promise<void> {
  await kvSet(storeKey.chatPrefs(network), prefs);
}

export async function loadChats(network: Network, vaultKey: Uint8Array, autodelete: boolean): Promise<Chat[]> {
  const ids = (await kvGet<string[]>(storeKey.chatIds(network))) ?? [];
  const chats: Chat[] = [];
  const keep: string[] = [];
  const cutoff = Date.now() - THIRTY_DAYS_MS;
  for (const id of ids) {
    const blob = await kvGet<string>(storeKey.chat(network, id));
    if (!blob) continue;
    try {
      const chat = await open(vaultKey, blob);
      if (autodelete && chat.updatedAt < cutoff) {
        await kvDel(storeKey.chat(network, id));
        const { deleteDeviceFiles } = await import("@/lib/chat/blobs");
        const { fileIdsIn } = await import("@/lib/chat/types");
        await deleteDeviceFiles(network, fileIdsIn(chat));
        continue;
      }
      chats.push(chat);
      keep.push(id);
    } catch {
      await kvDel(storeKey.chat(network, id));
    }
  }
  if (keep.length !== ids.length) await kvSet(storeKey.chatIds(network), keep);
  chats.sort((a, b) => b.updatedAt - a.updatedAt);
  return chats;
}

export async function deleteChat(network: Network, chat: Chat): Promise<void> {
  const { deleteDeviceFiles } = await import("@/lib/chat/blobs");
  const { fileIdsIn } = await import("@/lib/chat/types");
  await deleteDeviceFiles(network, fileIdsIn(chat));
  await kvDel(storeKey.chat(network, chat.id));
  const ids = (await kvGet<string[]>(storeKey.chatIds(network))) ?? [];
  await kvSet(storeKey.chatIds(network), ids.filter((id) => id !== chat.id));
}

export async function saveChat(network: Network, vaultKey: Uint8Array, chat: Chat): Promise<string> {
  const blob = await seal(vaultKey, chat);
  await kvSet(storeKey.chat(network, chat.id), blob);
  const ids = (await kvGet<string[]>(storeKey.chatIds(network))) ?? [];
  if (!ids.includes(chat.id)) await kvSet(storeKey.chatIds(network), [chat.id, ...ids]);
  return blob;
}

export async function deleteLocalChats(network: Network): Promise<void> {
  const ids = (await kvGet<string[]>(storeKey.chatIds(network))) ?? [];
  await Promise.all(ids.map((id) => kvDel(storeKey.chat(network, id))));
  await kvSet(storeKey.chatIds(network), []);
  const { deleteAllDeviceFiles } = await import("@/lib/chat/blobs");
  await deleteAllDeviceFiles(network);
}

export { open as openChatBlob, seal as sealChat };
