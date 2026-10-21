import { describe, expect, it } from "vitest";
import { addressKind, addressProblem, isShieldedAddress } from "@/lib/zcash/address";
import { zip321 } from "@/lib/zcash/zip321";
import { chatCostMicro } from "@/lib/zeep/prices";
import { estimateDeposit, formatCredits, formatZec, parseZec } from "@/lib/zeep/units";
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

  it("prices a chat from the model plus bytes past 64 KB", () => {
    expect(chatCostMicro(10_500, 1000, 1_000)).toBe(10_500n);
    expect(chatCostMicro(10_500, 65536 + 1, 1_000)).toBe(11_500n);
    expect(chatCostMicro(10_500, 65536 + 1024 * 1024, 1_000)).toBe(11_500n);
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
