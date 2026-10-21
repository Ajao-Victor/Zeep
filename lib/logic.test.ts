import { describe, expect, it } from "vitest";
import { addressProblem, isShieldedAddress } from "@/lib/zcash/address";
import { zip321 } from "@/lib/zcash/zip321";
import { chatCostZats } from "@/lib/zeep/prices";
import { formatCredits, formatZec, parseZec } from "@/lib/zeep/units";
import { quizIndexes } from "@/lib/vault/phrase";

describe("units", () => {
  it("treats credits as a display of zatoshis", () => {
    expect(parseZec("0.1")).toBe(10_000_000n);
    expect(formatZec(10_000_000n)).toBe("0.1");
    expect(formatCredits(10_000_000n, 10_000)).toBe("1,000");
    expect(formatCredits(400n, 10_000)).toBe("0.04");
  });

  it("prices a chat from the model plus bytes past 64 KB", () => {
    expect(chatCostZats(1000, 1000, 50)).toBe(1000n);
    expect(chatCostZats(1000, 65536 + 1, 50)).toBe(1050n);
    expect(chatCostZats(1000, 65536 + 1024 * 1024, 50)).toBe(1050n);
  });
});

describe("phrase", () => {
  it("quizzes words 3, 12 and 21 of a 24-word phrase", () => {
    expect(quizIndexes(24)).toEqual([3, 12, 21]);
  });
});

describe("zcash", () => {
  it("accepts shielded addresses per network and refuses transparent ones", () => {
    expect(isShieldedAddress("zs1exampleaddress", "mainnet")).toBe(true);
    expect(isShieldedAddress("utest1example", "testnet")).toBe(true);
    expect(addressProblem("t1transparent", "mainnet")).toMatch(/Transparent/);
    expect(addressProblem("zs1exampleaddress", "testnet")).toMatch(/testnet/);
  });

  it("builds a ZIP 321 URI with an amount and no memo", () => {
    const uri = zip321("zs1exampleaddress", "0.1");
    expect(uri.startsWith("zcash:zs1exampleaddress?")).toBe(true);
    expect(uri).toContain("amount=0.1");
    expect(uri).not.toContain("memo=");
  });
});
