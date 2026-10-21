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
  vault: (network: Network) => `vault:${network}`,
  meta: (network: Network) => `vault-meta:${network}`,
  notes: (network: Network) => `notes:${network}`,
  prefs: "prefs",
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

export async function kvKeys(): Promise<string[]> {
  const keys = await (await db()).getAllKeys("kv");
  return keys.map(String);
}
