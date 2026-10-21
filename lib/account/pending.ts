import type { Network } from "@/lib/config";
import { kvGet, kvSet, storeKey } from "@/lib/vault/db";

export type DevicePending = {
  deposit: boolean;
  withdrawal: boolean;
};

export async function readPending(network: Network): Promise<DevicePending> {
  return (await kvGet<DevicePending>(storeKey.pending(network))) ?? { deposit: false, withdrawal: false };
}

export async function writePending(network: Network, patch: Partial<DevicePending>): Promise<void> {
  const current = await readPending(network);
  await kvSet(storeKey.pending(network), { ...current, ...patch });
}
