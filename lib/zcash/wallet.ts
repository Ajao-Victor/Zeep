import { config, type Network } from "@/lib/config";

export type WalletSummary = { zats: bigint; address: string };

type Reply = { id: string; ok: true; zats?: string; address?: string } | { id: string; ok: false; error: string };

let worker: Worker | null = null;
const waiters = new Map<string, (value: Reply) => void>();

function ensure() {
  if (worker) return worker;
  worker = new Worker(new URL("../../workers/wallet.worker.ts", import.meta.url), { type: "module" });
  worker.onmessage = (event: MessageEvent<Reply>) => {
    const waiter = waiters.get(event.data.id);
    if (!waiter) return;
    waiters.delete(event.data.id);
    waiter(event.data);
  };
  return worker;
}

function call(body: Record<string, unknown>): Promise<Reply> {
  const id = crypto.randomUUID();
  return new Promise((resolve) => {
    waiters.set(id, resolve);
    ensure().postMessage({ ...body, id });
  });
}

export async function walletSummary(phrase: string, network: Network): Promise<WalletSummary> {
  const result = await call({
    type: "summary",
    phrase,
    network,
    url: config.lightwalletd[network],
  });
  if (!result.ok || !result.address) throw new Error(result.ok ? "The wallet returned no address." : result.error);
  return { zats: BigInt(result.zats ?? "0"), address: result.address };
}

export async function payFromWallet(phrase: string, network: Network, to: string, zats: bigint): Promise<void> {
  const result = await call({
    type: "pay",
    phrase,
    network,
    url: config.lightwalletd[network],
    to,
    zats: zats.toString(),
  });
  if (!result.ok) throw new Error(result.error);
}

export function closeWallet() {
  worker?.terminate();
  worker = null;
}
