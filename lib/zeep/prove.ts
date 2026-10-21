import { config } from "@/lib/config";
import type { ProveFn } from "@/lib/zeep/spend";

type Reply =
  | { id: string; ok: true; proof?: ProveResult["proof"]; publicSignals?: string[] }
  | { id: string; ok: false; error: string };

type ProveResult = Awaited<ReturnType<ProveFn>>;

let worker: Worker | null = null;
let ready: Promise<void> | null = null;
const waiters = new Map<string, { resolve: (value: Reply) => void; reject: (error: Error) => void }>();

function call(body: { type: string; [key: string]: unknown }): Promise<Reply> {
  if (!worker) throw new Error("The proof worker is not running.");
  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    waiters.set(id, { resolve, reject });
    worker?.postMessage({ ...body, id });
  });
}

export function startProver(): Promise<void> {
  if (ready) return ready;
  ready = (async () => {
    worker = new Worker(new URL("../../workers/spend.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<Reply>) => {
      const waiter = waiters.get(event.data.id);
      if (!waiter) return;
      waiters.delete(event.data.id);
      waiter.resolve(event.data);
    };
    const configured = await call({
      type: "configure",
      wasmUrl: config.spendWasmUrl,
      wasmSha: config.spendWasmSha256,
      zkeyUrl: config.spendZkeyUrl,
      zkeySha: config.spendZkeySha256,
    });
    if (!configured.ok) throw new Error(configured.error);
  })().catch((error) => {
    ready = null;
    worker?.terminate();
    worker = null;
    throw error;
  });
  return ready;
}

export function stopProver() {
  worker?.terminate();
  worker = null;
  ready = null;
  for (const waiter of waiters.values()) waiter.reject(new Error("The prover stopped."));
  waiters.clear();
}

export const workerProve: ProveFn = async (input) => {
  await startProver();
  const result = await call({ type: "prove", input });
  if (!result.ok || !result.proof || !result.publicSignals) {
    throw new Error(result.ok ? "The prover returned an empty proof." : result.error);
  }
  return { proof: result.proof, publicSignals: result.publicSignals };
};
