const ZATOSHI = 100_000_000n;

export function zecToZatoshi(zec: string): bigint {
  const trimmed = zec.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error("Amount must be a ZEC decimal");
  }
  const [whole, frac = ""] = trimmed.split(".");
  if (frac.length > 8) throw new Error("ZEC supports 8 decimal places");
  const fraction = (frac + "00000000").slice(0, 8);
  return BigInt(whole) * ZATOSHI + BigInt(fraction);
}

export function zatoshiToZec(value: bigint): string {
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const whole = abs / ZATOSHI;
  const fraction = (abs % ZATOSHI).toString().padStart(8, "0").replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole.toString()}${fraction ? `.${fraction}` : ""}`;
}

export function shareZatoshi(priceZec: string, credits: number, count: number): bigint {
  if (credits <= 0 || count <= 0) return 0n;
  return (zecToZatoshi(priceZec) * BigInt(count)) / BigInt(credits);
}

export function splitHalves(total: bigint): [bigint, bigint] {
  const first = total / 2n;
  return [first, total - first];
}

export function todayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function shortTag(tag: string): string {
  const bare = tag.startsWith("0x") ? tag.slice(2) : tag;
  return `0x${bare.slice(0, 4)}…`;
}

export function errorText(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Something went wrong on this device";
}
