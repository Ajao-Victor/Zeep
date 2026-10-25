import { describe, expect, it } from "vitest";
import { addressKind, addressProblem, isShieldedAddress } from "@/lib/zcash/address";
import { zip321 } from "@/lib/zcash/zip321";
import { chatCostMicro } from "@/lib/zeep/prices";
import { networkFeesCovered } from "@/lib/money/fees";
import { openedSlots } from "@/lib/money/follow";
import { estimateDeposit, formatCredits, formatZec, parseZec, zatsToMicroUsd, bpsOf } from "@/lib/zeep/units";
import { quizIndexes } from "@/lib/vault/phrase";

describe("units", () => {
  it("shows credits as dollars, with ZEC kept separate", () => {
    expect(parseZec("0.1")).toBe(10_000_000n);
    expect(formatZec(10_000_000n)).toBe("0.1");
    expect(formatCredits(1_000_000)).toBe("1");
    expect(formatCredits(10_500)).toBe("0.0105");
  });

  it("estimates a 50/50 deposit after the conversion fee", () => {
    const estimate = estimateDeposit(50_000_000n, 100, 5_000, 150);
    expect(estimate.zecZats).toBe(25_000_000n);
    expect(estimate.usdMicro).toBe(24_625_000n);
    expect(estimate.totalMicro).toBe(49_625_000n);
  });

  it("matches the server deposit split, including a remainder zat", () => {
    const zats = 50_000_001n;
    const price = 48.25;
    const estimate = estimateDeposit(zats, price, 5_000, 150);
    const kept = Math.floor((Number(zats) * 5_000) / 10_000);
    const converted = Number(zats) - kept;
    const value = zatsToMicroUsd(converted, price);
    const fee = bpsOf(value, 150);
    expect(estimate.zecZats).toBe(BigInt(kept));
    expect(estimate.usdMicro).toBe(BigInt(value - fee));
  });

  it("prices a chat from the model plus bytes past 64 KB", () => {
    expect(chatCostMicro(10_500, 1000, 1_000)).toBe(10_500n);
    expect(chatCostMicro(10_500, 65536 + 1, 1_000)).toBe(11_500n);
    expect(chatCostMicro(10_500, 65536 + 1024 * 1024, 1_000)).toBe(11_500n);
  });
});

describe("withdrawal network fees", () => {
  const base = {
    freeAvailable: true,
    usedToday: false,
    minMicro: 1_000_000,
    zecUsd: 50,
    zecBalanceZats: 10_000_000n,
    usdBalanceMicro: 2_000_000n,
  };

  it("covers the fee when the tagged ZEC part is worth at least $1", () => {
    expect(networkFeesCovered({ ...base, requestedZats: 2_000_000n })).toBe(true);
  });

  it("does not cover a withdrawal whose tagged part is under $1", () => {
    expect(networkFeesCovered({ ...base, requestedZats: 100_000n })).toBe(false);
    expect(networkFeesCovered({ ...base, usedToday: true, requestedZats: 2_000_000n })).toBe(false);
    expect(networkFeesCovered({ ...base, freeAvailable: false, requestedZats: "all" })).toBe(false);
  });
});

describe("deposit claims", () => {
  it("records only the slots a status call opened", () => {
    expect(openedSlots(4, 4)).toEqual([]);
    expect(openedSlots(4, 6)).toEqual([4, 5]);
  });
});

describe("phrase", () => {
  it("quizzes words 3, 12 and 21 of a 24-word phrase", () => {
    expect(quizIndexes(24)).toEqual([3, 12, 21]);
  });
});

describe("zcash", () => {
  it("accepts shielded and transparent addresses per network", () => {
    expect(isShieldedAddress("zs1exampleaddress", "mainnet")).toBe(true);
    expect(isShieldedAddress("utest1example", "testnet")).toBe(true);
    expect(addressKind("t1transparent", "mainnet")).toBe("transparent");
    expect(addressKind("tmtest", "testnet")).toBe("transparent");
    expect(addressProblem("t1transparent", "mainnet")).toBeNull();
    expect(addressProblem("zs1exampleaddress", "testnet")).toMatch(/testnet/);
  });

  it("builds a ZIP 321 URI with an amount and no memo", () => {
    const uri = zip321("zs1exampleaddress", "0.1");
    expect(uri.startsWith("zcash:zs1exampleaddress?")).toBe(true);
    expect(uri).toContain("amount=0.1");
    expect(uri).not.toContain("memo=");
  });
});
