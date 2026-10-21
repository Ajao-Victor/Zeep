declare module "snarkjs" {
  export const groth16: {
    verify(vk: object, publicSignals: string[], proof: object, logger?: unknown): Promise<boolean>;
    fullProve(
      input: Record<string, unknown>,
      wasm: string | Uint8Array,
      zkey: string | Uint8Array,
    ): Promise<{ proof: { pi_a: string[]; pi_b: string[][]; pi_c: string[] }; publicSignals: string[] }>;
  };
}
