// Display units. Money is ZEC (zatoshis); credits are only how the app shows it.
// Default: 0.1 ZEC = 1,000 credits → 1 credit = 10,000 zats, 1 zat = 0.0001 credit.
export const ZATS_PER_ZEC = 100_000_000n;

export function zatsToCredits(zats: bigint | number, zatsPerCredit = 10_000): number {
  return Number(zats) / zatsPerCredit;
}

/** "12.3456" style: up to 4 decimals (1 zat), trailing zeros trimmed. */
export function formatCredits(zats: bigint | number, zatsPerCredit = 10_000): string {
  const v = zatsToCredits(zats, zatsPerCredit);
  const decimals = Math.max(0, Math.round(Math.log10(zatsPerCredit)));
  return v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: decimals });
}

export function formatZec(zats: bigint | number): string {
  const z = BigInt(zats);
  const whole = z / ZATS_PER_ZEC;
  const frac = (z % ZATS_PER_ZEC).toString().padStart(8, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole.toString();
}

export function parseZec(input: string): bigint {
  const t = input.trim();
  if (!/^\d+(\.\d{0,8})?$/.test(t)) throw new Error("Enter an amount in ZEC with up to 8 decimals.");
  const [w, f = ""] = t.split(".");
  return BigInt(w) * ZATS_PER_ZEC + BigInt((f + "00000000").slice(0, 8));
}

export function creditsToZats(credits: number, zatsPerCredit = 10_000): bigint {
  return BigInt(Math.round(credits * zatsPerCredit));
}
