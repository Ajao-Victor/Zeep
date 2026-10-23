import { describe, expect, it } from "vitest";
import { forgeIdle, forgeStep, type ForgeSignal, type ForgeState } from "@/lib/fx/forge";

const run = (signals: ForgeSignal[], from: ForgeState = forgeIdle) => signals.reduce(forgeStep, from);

describe("the Forge phases", () => {
  it("walks a paid request from identity to gold to white", () => {
    expect(run(["pay"]).phase).toBe("preparing");
    expect(run(["pay", "start"]).phase).toBe("proving");
    expect(run(["pay", "start", "end"]).phase).toBe("sending");
    expect(run(["pay", "start", "end", "ok"]).phase).toBe("settled");
    expect(run(["pay", "start", "end", "ok", "rest"])).toEqual(forgeIdle);
  });

  it("spins again for every real proof in one click, and only sends when the last one ends", () => {
    expect(run(["pay", "start", "end", "start"]).phase).toBe("proving");
    expect(run(["pay", "start", "start", "end"]).phase).toBe("proving");
    expect(run(["pay", "start", "start", "end", "end"]).phase).toBe("sending");
  });

  it("fails from any in-flight phase, then rests", () => {
    expect(run(["pay", "fail"]).phase).toBe("failed");
    expect(run(["pay", "start", "fail"]).phase).toBe("failed");
    expect(run(["pay", "start", "end", "fail", "rest"])).toEqual(forgeIdle);
  });

  it("ignores prover edges that do not belong to a click", () => {
    expect(run(["start"])).toEqual(forgeIdle);
    expect(run(["end"])).toEqual(forgeIdle);
    expect(run(["pay", "start", "end", "ok", "start"]).phase).toBe("settled");
    expect(run(["ok"])).toEqual(forgeIdle);
    expect(run(["pay", "rest"]).phase).toBe("preparing");
  });

  it("restarts cleanly when a new click lands during the outcome", () => {
    expect(run(["pay", "start", "end", "ok", "pay"])).toEqual({ phase: "preparing", proofs: 0 });
  });
});
