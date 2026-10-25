import { openDB, type IDBPDatabase } from "idb";
import type { Network } from "@/lib/config";

type ZeepDb = {
  kv: {
    key: string;
    value: unknown;
  };
};

let opening: Promise<IDBPDatabase<ZeepDb>> | null = null;

function db() {
  if (!opening) {
    opening = openDB<ZeepDb>("zeep", 1, {
      upgrade(database) {
        database.createObjectStore("kv");
      },
    });
  }
  return opening;
}

export async function kvGet<T>(key: string): Promise<T | undefined> {
  return (await db()).get("kv", key) as Promise<T | undefined>;
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  await (await db()).put("kv", value, key);
}

export async function kvDel(key: string): Promise<void> {
  await (await db()).delete("kv", key);
}

export const storeKey = {
  vault: (network: Network) => `zeep:${network}:vault`,
  meta: (network: Network) => `zeep:${network}:vault-meta`,
  notes: (network: Network) => `zeep:${network}:notes`,
  prefs: "prefs",
  chatPrefs: (network: Network) => `zeep:${network}:chat-prefs`,
  chatIds: (network: Network) => `zeep:${network}:chat-ids`,
  chat: (network: Network, id: string) => `zeep:${network}:chat:${id}`,
  feeDay: (network: Network) => `zeep:${network}:fee-day`,
  pending: (network: Network) => `zeep:${network}:pending`,
  walletMeta: (network: Network) => `zeep:${network}:wallet-meta`,
  fileIds: (network: Network) => `zeep:${network}:file-ids`,
  file: (network: Network, id: string) => `zeep:${network}:file:${id}`,
  fileBytes: (network: Network, id: string) => `zeep:${network}:file-bytes:${id}`,
  thumb: (network: Network, id: string) => `zeep:${network}:thumb:${id}`,
};

const legacyKey = {
  vault: (network: Network) => `vault:${network}`,
  meta: (network: Network) => `vault-meta:${network}`,
  notes: (network: Network) => `notes:${network}`,
  chatPrefs: (network: Network) => `chat-prefs:${network}`,
  chatIds: (network: Network) => `chat-ids:${network}`,
  chat: (network: Network, id: string) => `chat:${network}:${id}`,
  feeDay: (network: Network) => `fee-day:${network}`,
  pending: (network: Network) => `pending:${network}`,
  walletMeta: (network: Network) => `wallet-meta:${network}`,
  fileIds: (network: Network) => `file-ids:${network}`,
  file: (network: Network, id: string) => `file:${network}:${id}`,
  fileBytes: (network: Network, id: string) => `file-bytes:${network}:${id}`,
  thumb: (network: Network, id: string) => `thumb:${network}:${id}`,
};

let migrated = false;

/** Copy records saved before keys were prefixed with zeep:{network}. */
export async function migrateStore(network: Network): Promise<void> {
  if (migrated) return;
  migrated = true;
  const pairs: [string, string][] = [
    [legacyKey.vault(network), storeKey.vault(network)],
    [legacyKey.meta(network), storeKey.meta(network)],
    [legacyKey.notes(network), storeKey.notes(network)],
    [legacyKey.chatPrefs(network), storeKey.chatPrefs(network)],
    [legacyKey.feeDay(network), storeKey.feeDay(network)],
    [legacyKey.pending(network), storeKey.pending(network)],
    [legacyKey.walletMeta(network), storeKey.walletMeta(network)],
  ];
  for (const [from, to] of pairs) {
    if ((await kvGet(to)) !== undefined) continue;
    const value = await kvGet(from);
    if (value !== undefined) await kvSet(to, value);
  }
  if ((await kvGet(storeKey.chatIds(network))) === undefined) {
    const ids = await kvGet<string[]>(legacyKey.chatIds(network));
    if (ids) {
      for (const id of ids) {
        const blob = await kvGet(legacyKey.chat(network, id));
        if (blob !== undefined && (await kvGet(storeKey.chat(network, id))) === undefined) {
          await kvSet(storeKey.chat(network, id), blob);
        }
      }
      await kvSet(storeKey.chatIds(network), ids);
    }
  }
  if ((await kvGet(storeKey.fileIds(network))) === undefined) {
    const ids = await kvGet<string[]>(legacyKey.fileIds(network));
    if (ids) {
      for (const id of ids) {
        for (const [from, to] of [
          [legacyKey.file(network, id), storeKey.file(network, id)],
          [legacyKey.fileBytes(network, id), storeKey.fileBytes(network, id)],
          [legacyKey.thumb(network, id), storeKey.thumb(network, id)],
        ] as const) {
          if ((await kvGet(to)) !== undefined) continue;
          const value = await kvGet(from);
          if (value !== undefined) await kvSet(to, value);
        }
      }
      await kvSet(storeKey.fileIds(network), ids);
    }
  }
}

export async function kvKeys(): Promise<string[]> {
  const keys = await (await db()).getAllKeys("kv");
  return keys.map(String);
}
