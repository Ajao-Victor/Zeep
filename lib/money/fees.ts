import { zatsToMicroUsd } from "@/lib/zeep/units";

/**
 * Zeep pays the two withdrawal network fees only on the first withdrawal of the UTC day,
 * and only when the tagged part (the larger of the ZEC part and the dollar part) is worth
 * at least `minMicro`. A smaller withdrawal still goes through; the fees come out of the ZEC.
 */
export function networkFeesCovered(input: {
  freeAvailable: boolean;
  usedToday: boolean;
  minMicro: number;
  zecUsd: number;
  zecBalanceZats: bigint;
  usdBalanceMicro: bigint;
  requestedZats: bigint | "all";
}): boolean {
  if (!input.freeAvailable || input.usedToday || !(input.zecUsd > 0) || !(input.minMicro > 0)) return false;
  const zecPart = input.requestedZats === "all" || input.requestedZats > input.zecBalanceZats ? input.zecBalanceZats : input.requestedZats;
  const zecMicro = zatsToMicroUsd(zecPart, input.zecUsd);
  const usdMicro = input.requestedZats === "all"
    ? Number(input.usdBalanceMicro)
    : input.requestedZats > input.zecBalanceZats
      ? zatsToMicroUsd(input.requestedZats - input.zecBalanceZats, input.zecUsd)
      : 0;
  return Math.max(zecMicro, usdMicro) >= input.minMicro;
}
