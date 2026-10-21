/// <reference lib="webworker" />

import { argon2id } from "hash-wasm";

declare const self: DedicatedWorkerGlobalScope;

type KdfRequest = {
  id: string;
  pin: string;
  salt: Uint8Array;
  memorySize: number;
  iterations: number;
};

self.onmessage = async (event: MessageEvent<KdfRequest>) => {
  const message = event.data;
  try {
    const hash = await argon2id({
      password: message.pin,
      salt: message.salt,
      parallelism: 1,
      iterations: message.iterations,
      memorySize: message.memorySize,
      hashLength: 32,
      outputType: "binary",
    });
    self.postMessage({ id: message.id, hash });
  } catch (error) {
    self.postMessage({
      id: message.id,
      error: error instanceof Error ? error.message : "Key derivation failed",
    });
  }
};
