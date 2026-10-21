import type { Network } from "@/lib/config";

export type AddressKind = "shielded" | "transparent" | "invalid";

export function addressKind(address: string, network: Network): AddressKind {
  const value = address.trim();
  if (!value || /\s/.test(value)) return "invalid";
  if (network === "mainnet") {
    if (value.startsWith("zs1") || value.startsWith("u1")) return "shielded";
    if (value.startsWith("t1") || value.startsWith("t3")) return "transparent";
    return "invalid";
  }
  if (value.startsWith("ztestsapling") || value.startsWith("utest1")) return "shielded";
  if (value.startsWith("tm") || value.startsWith("t2")) return "transparent";
  return "invalid";
}

export function isShieldedAddress(address: string, network: Network): boolean {
  return addressKind(address, network) === "shielded";
}

export function addressProblem(address: string, network: Network): string | null {
  const kind = addressKind(address, network);
  if (kind === "shielded" || kind === "transparent") return null;
  const value = address.trim();
  if (!value) return "Paste a Zcash address.";
  return network === "mainnet"
    ? "Use a mainnet address (u1, zs1, t1, or t3)."
    : "Use a testnet address (utest, ztestsapling, tm, or t2).";
}
