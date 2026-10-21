import { apiBase, type Network } from "@/lib/config";
import type { ZeepKeys } from "@/lib/zeep";
import { deleteLocalChats, loadChats, openChatBlob, saveChat } from "@/lib/chat/store";
import type { Chat } from "@/lib/chat/types";
import { THIRTY_DAYS_MS } from "@/lib/chat/types";

function headers(keys: ZeepKeys): HeadersInit {
  return { "x-vault-auth": keys.vaultAuth, "content-type": "application/json" };
}

export function expiresAt(chat: Chat, autodelete: boolean): string | null {
  if (!autodelete) return null;
  return new Date(chat.updatedAt + THIRTY_DAYS_MS).toISOString();
}

export async function pushChat(network: Network, keys: ZeepKeys, chat: Chat, blob: string, autodelete: boolean): Promise<void> {
  const response = await fetch(`${apiBase(network)}/v1/vault/${keys.vaultId}/items/chat-${chat.id}`, {
    method: "PUT",
    headers: headers(keys),
    body: JSON.stringify({ blob, expires_at: expiresAt(chat, autodelete) }),
    credentials: "omit",
    referrerPolicy: "no-referrer",
  });
  if (!response.ok && response.status !== 204) throw new Error(`Chat sync failed (${response.status}).`);
}

export async function pullChats(network: Network, keys: ZeepKeys, autodelete: boolean): Promise<Chat[]> {
  const list = await fetch(`${apiBase(network)}/v1/vault/${keys.vaultId}/items`, {
    headers: { "x-vault-auth": keys.vaultAuth },
    credentials: "omit",
    referrerPolicy: "no-referrer",
  });
  if (list.status === 404) return loadChats(network, keys.vaultKey, autodelete);
  if (!list.ok) throw new Error(`Chat sync failed (${list.status}).`);
  const body = (await list.json()) as { items?: { item_id: string }[] };
  const local = await loadChats(network, keys.vaultKey, autodelete);
  const byId = new Map(local.map((chat) => [chat.id, chat]));
  for (const item of body.items ?? []) {
    if (!item.item_id.startsWith("chat-")) continue;
    const id = item.item_id.slice(5);
    const one = await fetch(`${apiBase(network)}/v1/vault/${keys.vaultId}/items/${item.item_id}`, {
      headers: { "x-vault-auth": keys.vaultAuth },
      credentials: "omit",
      referrerPolicy: "no-referrer",
    });
    if (!one.ok) continue;
    const row = (await one.json()) as { blob?: string };
    if (!row.blob) continue;
    const remote = await openChatBlob(keys.vaultKey, row.blob);
    const existing = byId.get(id);
    if (!existing || remote.updatedAt > existing.updatedAt) {
      await saveChat(network, keys.vaultKey, remote);
      byId.set(remote.id, remote);
    }
  }
  return [...byId.values()].sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function deleteRemoteChat(network: Network, keys: ZeepKeys, id: string): Promise<void> {
  const response = await fetch(`${apiBase(network)}/v1/vault/${keys.vaultId}/items/chat-${id}`, {
    method: "DELETE",
    headers: { "x-vault-auth": keys.vaultAuth },
    credentials: "omit",
    referrerPolicy: "no-referrer",
  });
  if (!response.ok && response.status !== 404 && response.status !== 204) {
    throw new Error(`The synced chat was not removed (${response.status}).`);
  }
}

export async function deleteRemoteVault(network: Network, keys: ZeepKeys): Promise<void> {
  await deleteLocalChats(network);
  const response = await fetch(`${apiBase(network)}/v1/vault/${keys.vaultId}`, {
    method: "DELETE",
    headers: { "x-vault-auth": keys.vaultAuth },
    credentials: "omit",
    referrerPolicy: "no-referrer",
  });
  if (!response.ok && response.status !== 404 && response.status !== 204) {
    throw new Error(`The server vault was not cleared (${response.status}).`);
  }
}
