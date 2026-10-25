import { config, type Network } from "@/lib/config";

export type WalletSummary = {
  shieldedZats: bigint;
  transparentZats: bigint;
  unified: string;
  transparentAddress: string;
  shielding: boolean;
  height: number;
};

type Reply =
  | {
      id: string;
      ok: true;
      shieldedZats?: string;
      transparentZats?: string;
      unified?: string;
      transparentAddress?: string;
      shielding?: boolean;
      height?: number;
    }
  | { id: string; ok: false; error: string };

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

export async function walletSummary(phrase: string, network: Network, birthday = 0): Promise<WalletSummary> {
  const result = await call({
    type: "summary",
    phrase,
    network,
    url: config.lightwalletd[network],
    minZats: String(config.autoshieldMinZats),
    birthday,
  });
  if (!result.ok || !result.unified) throw new Error(result.ok ? "The wallet returned no address." : result.error);
  return {
    shieldedZats: BigInt(result.shieldedZats ?? "0"),
    transparentZats: BigInt(result.transparentZats ?? "0"),
    unified: result.unified,
    transparentAddress: result.transparentAddress ?? "",
    shielding: Boolean(result.shielding),
    height: result.height ?? 0,
  };
}

export async function payFromWallet(phrase: string, network: Network, to: string, zats: bigint, birthday = 0): Promise<void> {
  const result = await call({
    type: "pay",
    phrase,
    network,
    url: config.lightwalletd[network],
    to,
    zats: zats.toString(),
    minZats: String(config.autoshieldMinZats),
    birthday,
  });
  if (!result.ok) throw new Error(result.error);
}

export function closeWallet() {
  worker?.terminate();
  worker = null;
}
