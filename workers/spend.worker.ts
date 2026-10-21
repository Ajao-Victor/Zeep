/// <reference lib="webworker" />

import { groth16 } from "snarkjs";

type Configure = {
  id: string;
  type: "configure";
  wasmUrl: string;
  wasmSha: string;
  zkeyUrl: string;
  zkeySha: string;
};

type Prove = { id: string; type: "prove"; input: Record<string, unknown> };

let wasmBytes: Uint8Array | null = null;
let zkeyBytes: Uint8Array | null = null;

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const copy = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const digest = await crypto.subtle.digest("SHA-256", copy);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function loadCircuit(url: string, expect: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load ${url}.`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (expect && (await sha256Hex(bytes)) !== expect.toLowerCase()) {
    throw new Error(`Refusing to prove. ${url} does not match its pinned hash.`);
  }
  return bytes;
}

self.onmessage = async (event: MessageEvent<Configure | Prove>) => {
  const message = event.data;
  try {
    if (message.type === "configure") {
      wasmBytes = await loadCircuit(message.wasmUrl, message.wasmSha);
      zkeyBytes = await loadCircuit(message.zkeyUrl, message.zkeySha);
      self.postMessage({ id: message.id, ok: true });
      return;
    }
    if (!wasmBytes || !zkeyBytes) throw new Error("The spend circuit is not loaded.");
    const proved = await groth16.fullProve(message.input, wasmBytes, zkeyBytes);
    self.postMessage({ id: message.id, ok: true, proof: proved.proof, publicSignals: proved.publicSignals });
  } catch (cause) {
    self.postMessage({ id: message.id, ok: false, error: cause instanceof Error ? cause.message : "The prover failed." });
  }
};
