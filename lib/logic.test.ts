import { describe, expect, it } from "vitest";
import { addressKind, addressProblem, isShieldedAddress } from "@/lib/zcash/address";
import { zip321 } from "@/lib/zcash/zip321";
import { chatCostMicro } from "@/lib/zeep/client";
import { estimateDeposit, formatCredits, formatZec, parseZec, zatsToMicroUsd, bpsOf } from "@/lib/zeep/units";
import { ACTIVITY_MS, recentActivity, spendTitle, type Activity } from "@/lib/account/activity";
import { quizIndexes } from "@/lib/vault/phrase";
import { serviceAt } from "@/lib/catalog";

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

  it("prices a flat chat from the model plus bytes past 64 KB", () => {
    const sheet = {
      markup_bps: 0,
      attachments: { micro_usd_per_mb: 1_000 },
      models: [{ id: "flat", micro_usd: 10_500, metered: null }],
    };
    expect(chatCostMicro(sheet, "flat", "a".repeat(1000))).toBe(10_500n);
    expect(chatCostMicro(sheet, "flat", "a".repeat(65537))).toBe(11_500n);
    expect(chatCostMicro(sheet, "flat", "a".repeat(65536 + 1024 * 1024))).toBe(11_500n);
  });

  it("prices a metered chat from the input and the output cap", () => {
    const sheet = {
      markup_bps: 0,
      attachments: { micro_usd_per_mb: 1_000 },
      models: [{
        id: "frontier",
        micro_usd: 1,
        metered: {
          in_usd_per_m: 1,
          out_usd_per_m: 2,
          min_usd: 0.01,
          default_output: 200,
          max_output: 16000,
          bytes_per_token: 3,
          image_tokens: 1500,
          message_tokens: 8,
        },
      }],
    };
    const short = JSON.stringify({ messages: [{ content: "hi" }] });
    const long = JSON.stringify({ messages: [{ content: "hi" }], max_tokens: 16000 });
    expect(chatCostMicro(sheet, "frontier", long)).toBeGreaterThan(chatCostMicro(sheet, "frontier", short));
  });
});

describe("activity", () => {
  const now = Date.UTC(2026, 9, 25, 12);
  const item = (at: number, id: string): Activity => ({ id, at, kind: "spend", title: "AI", detail: "−1 cr" });

  it("keeps the last 24 hours, newest first", () => {
    const items = recentActivity([
      item(now - ACTIVITY_MS, "gone"),
      item(now - ACTIVITY_MS + 1, "edge"),
      item(now - 60_000, "new"),
    ], now);
    expect(items.map((entry) => entry.id)).toEqual(["new", "edge"]);
  });

  it("names a payment from its route", () => {
    expect(spendTitle("/v1/ai/chat/completions")).toBe("AI");
    expect(spendTitle("/v1/research")).toBe("Research");
    expect(spendTitle("/v1/health/lookup")).toBe("Health");
    // Retired routes (Blockchain access) fall back to the generic title.
    expect(spendTitle("/v1/rpc/ethereum")).toBe("Payment");
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

describe("catalog", () => {
  it("trusts only the service routes as a next page", () => {
    expect(serviceAt("/ai")?.id).toBe("ai");
    expect(serviceAt("/inbox")?.name).toBe("Anonymous inbox");
    for (const path of [null, "", "/", "/chain", "/wallet", "/services", "//evil.example/ai", "https://evil.example/ai", "/ai?x=1", "/AI"]) {
      expect(serviceAt(path)).toBeNull();
    }
  });
});
