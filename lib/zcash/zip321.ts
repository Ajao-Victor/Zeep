import { b64url } from "@/lib/bytes";

export function zip321(address: string, amountZec: string, memo?: Uint8Array): string {
  if (!/^\d+(\.\d{1,8})?$/.test(amountZec)) {
    throw new Error("Amount must be a ZEC decimal");
  }
  const params = new URLSearchParams();
  params.set("amount", amountZec);
  if (memo && memo.length) params.set("memo", b64url(memo));
  return `zcash:${address}?${params.toString()}`;
}
