import { formatCredits } from "@/lib/zeep/units";
import { kvGet, kvSet, storeKey } from "@/lib/vault/db";
import { readSession } from "@/lib/vault/session";
import type { Network } from "@/lib/config";

export const ACTIVITY_MS = 24 * 60 * 60 * 1000;
export const ACTIVITY_PREVIEW = 3;

export type ActivityKind = "deposit" | "withdraw" | "spend" | "send";

export type Activity = {
  id: string;
  at: number;
  kind: ActivityKind;
  title: string;
  detail: string;
};

const listeners = new Set<() => void>();
let writing: Promise<void> = Promise.resolve();

export function recentActivity(items: Activity[], now = Date.now()): Activity[] {
  return items
    .filter((item) => Number.isFinite(item.at) && item.at <= now && now - item.at < ACTIVITY_MS)
    .sort((a, b) => b.at - a.at);
}

export function subscribeActivity(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify() {
  listeners.forEach((listener) => listener());
}

export function spendTitle(path: string): string {
  if (path.startsWith("/v1/ai/")) return "AI";
  if (path.startsWith("/v1/search")) return "Search";
  if (path.startsWith("/v1/research")) return "Research";
  if (path.startsWith("/v1/health")) return "Health";
  if (path.startsWith("/v1/inbox")) return "Inbox";
  return "Payment";
}

export async function readActivity(network: Network): Promise<Activity[]> {
  const stored = (await kvGet<Activity[]>(storeKey.activity(network))) ?? [];
  const items = recentActivity(stored);
  if (items.length !== stored.length) await kvSet(storeKey.activity(network), items);
  return items;
}

export function rememberActivity(network: Network, item: Omit<Activity, "id" | "at"> & { id?: string; at?: number }): Promise<void> {
  const run = writing.then(async () => {
    const stored = (await kvGet<Activity[]>(storeKey.activity(network))) ?? [];
    const next: Activity = {
      id: item.id ?? crypto.randomUUID(),
      at: item.at ?? Date.now(),
      kind: item.kind,
      title: item.title,
      detail: item.detail,
    };
    await kvSet(
      storeKey.activity(network),
      recentActivity([next, ...stored.filter((current) => current.id !== next.id)]),
    );
    notify();
  });
  writing = run.then(() => undefined, () => undefined);
  return run;
}

export function rememberSpend(network: Network, path: string, micro: bigint): Promise<void> {
  const per = readSession()?.prices?.micro_usd_per_credit ?? 1_000_000;
  return rememberActivity(network, {
    kind: "spend",
    title: spendTitle(path),
    detail: `−${formatCredits(micro, per)} cr`,
  });
}
