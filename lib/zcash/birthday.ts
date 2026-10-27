import { apiBase, type Network } from "@/lib/config";
import { zeepFetch } from "@/lib/api/zfetch";
import type { ZeepKeys } from "@/lib/zeep";
import { kvGet, kvSet, storeKey } from "@/lib/vault/db";
import { decryptJson, encryptJson, importAes } from "@/lib/vault/crypto";
import type { CipherBlob } from "@/lib/vault/types";

/** Sapling activation. Used only when a wallet has no saved birthday. */
export function saplingBirthday(network: Network): number {
  return network === "mainnet" ? 419200 : 280000;
}

async function seal(vaultKey: Uint8Array, birthday: number): Promise<string> {
  const key = await importAes(vaultKey);
  const blob = await encryptJson(key, { birthday });
  return JSON.stringify(blob);
}

async function open(vaultKey: Uint8Array, packed: string): Promise<number | null> {
  const key = await importAes(vaultKey);
  const value = await decryptJson<{ birthday?: number }>(key, JSON.parse(packed) as CipherBlob);
  return value.birthday && value.birthday > 0 ? value.birthday : null;
}

export async function readWalletBirthday(network: Network, keys: ZeepKeys): Promise<number | null> {
  try {
    const response = await zeepFetch(network)(`${apiBase(network)}/v1/vault/items/wallet-meta`, {
      headers: { "x-vault-id": keys.vaultId, "x-vault-auth": keys.vaultAuth },
      credentials: "omit",
      referrerPolicy: "no-referrer",
    });
    if (response.ok) {
      const body = (await response.json()) as { blob?: string };
      if (body.blob) {
        const birthday = await open(keys.vaultKey, body.blob);
        if (birthday) return birthday;
      }
    }
  } catch {
    // The local copy is the fallback when the vault is unreachable.
  }
  const local = await kvGet<string>(storeKey.walletMeta(network));
  if (!local) return null;
  return open(keys.vaultKey, local).catch(() => null);
}

export async function rememberBirthday(network: Network, keys: ZeepKeys, height: number): Promise<void> {
  if (height <= 0) return;
  const existing = await kvGet<string>(storeKey.walletMeta(network));
  if (existing) return;
  const packed = await seal(keys.vaultKey, height);
  await kvSet(storeKey.walletMeta(network), packed);
  await zeepFetch(network)(`${apiBase(network)}/v1/vault/items/wallet-meta`, {
    method: "PUT",
    headers: { "x-vault-id": keys.vaultId, "x-vault-auth": keys.vaultAuth, "content-type": "application/json" },
    body: JSON.stringify({ blob: packed }),
    credentials: "omit",
    referrerPolicy: "no-referrer",
  }).catch(() => undefined);
}
