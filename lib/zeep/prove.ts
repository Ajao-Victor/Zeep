import { config } from "@/lib/config";
import type { ProveFn } from "@/lib/zeep/spend";

type Reply =
  | { id: string; ok: true; proof?: ProveResult["proof"]; publicSignals?: string[] }
  | { id: string; ok: false; error: string };

type ProveResult = Awaited<ReturnType<ProveFn>>;

/** "start" when a proof is handed to the worker, "end" when it comes back (proved or failed). */
export type ProofEvent = "start" | "end";

let worker: Worker | null = null;
let ready: Promise<void> | null = null;
const waiters = new Map<string, { resolve: (value: Reply) => void; reject: (error: Error) => void }>();
const listeners = new Set<(event: ProofEvent) => void>();

/**
 * Subscribe to the prover's real start and end edges (the Forge animation listens here).
 * Every proof emits, including merges and refills inside one `client.pay`. Returns the unsubscribe.
 */
export function onProof(listener: (event: ProofEvent) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit(event: ProofEvent) {
  for (const listener of [...listeners]) listener(event);
}

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
  emit("start");
  let result: Reply;
  try {
    result = await call({ type: "prove", input });
  } finally {
    emit("end");
  }
  if (!result.ok || !result.proof || !result.publicSignals) {
    throw new Error(result.ok ? "The prover returned an empty proof." : result.error);
  }
  return { proof: result.proof, publicSignals: result.publicSignals };
};
