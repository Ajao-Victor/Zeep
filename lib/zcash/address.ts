import type { Network } from "@/lib/config";

export function isShieldedAddress(address: string, network: Network): boolean {
  const value = address.trim();
  if (!value || /\s/.test(value)) return false;
  if (network === "mainnet") {
    return value.startsWith("zs1") || value.startsWith("u1");
  }
  return value.startsWith("ztestsapling") || value.startsWith("utest1");
}

export function addressProblem(address: string, network: Network): string | null {
  const value = address.trim();
  if (!value) return "Paste a shielded address.";
  if (value.startsWith("t1") || value.startsWith("t3") || value.startsWith("tm")) {
    return "Transparent addresses are refused. Use a shielded address.";
  }
  if (!isShieldedAddress(value, network)) {
    return network === "mainnet"
      ? "Use a mainnet shielded address (zs1 or u1)."
      : "Use a testnet shielded address (ztestsapling or utest1).";
  }
  return null;
}
