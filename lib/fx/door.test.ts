import { describe, expect, it } from "vitest";
import { doorStep, type DoorSignal, type DoorState } from "@/lib/fx/door";

const run = (from: DoorState, signals: DoorSignal[]) => signals.reduce(doorStep, from);
const closed: DoorState = { phase: "closed", warn: false };
const open: DoorState = { phase: "open", warn: false };

describe("the Vault Door", () => {
  it("unlocks: turns while Argon2id runs, opens on success, then hands over", () => {
    expect(run(closed, [{ type: "kdf" }]).phase).toBe("deriving");
    expect(run(closed, [{ type: "kdf" }, { type: "ok" }]).phase).toBe("opening");
    expect(run(closed, [{ type: "kdf" }, { type: "ok" }, { type: "rest" }]).phase).toBe("unsealed");
  });

  it("opens straight from closed for a fingerprint unlock, which derives nothing", () => {
    expect(run(closed, [{ type: "ok" }]).phase).toBe("opening");
  });

  it("jolts back on a wrong PIN and warns at one try left", () => {
    const wrong = run(closed, [{ type: "kdf" }, { type: "fail", attemptsLeft: 3 }]);
    expect(wrong).toEqual({ phase: "rejected", warn: false });
    expect(run(wrong, [{ type: "rest" }]).phase).toBe("closed");
    const last = run(closed, [{ type: "kdf" }, { type: "fail", attemptsLeft: 1 }, { type: "rest" }]);
    expect(last).toEqual({ phase: "closed", warn: true });
    expect(run(last, [{ type: "kdf" }]).warn).toBe(true);
    expect(run(last, [{ type: "kdf" }, { type: "ok" }]).warn).toBe(false);
  });

  it("can try again during the jolt", () => {
    expect(run(closed, [{ type: "kdf" }, { type: "fail", attemptsLeft: 2 }, { type: "kdf" }]).phase).toBe("deriving");
  });

  it("greys out for good when the vault is wiped", () => {
    const wiped = run(closed, [{ type: "kdf" }, { type: "fail", wiped: true }]);
    expect(wiped.phase).toBe("wiped");
    expect(run(wiped, [{ type: "close" }, { type: "kdf" }, { type: "ok" }]).phase).toBe("wiped");
  });

  it("seals a new vault while createVault derives, and reopens if saving fails", () => {
    expect(run(open, [{ type: "kdf" }]).phase).toBe("sealing");
    expect(run(open, [{ type: "kdf" }, { type: "ok" }]).phase).toBe("sealed");
    expect(run(open, [{ type: "kdf" }, { type: "fail" }]).phase).toBe("open");
    expect(run(open, [{ type: "kdf" }, { type: "ok" }, { type: "rest" }]).phase).toBe("closed");
  });

  it("closes on lock or network switch, then rests closed and can unlock again", () => {
    const shut = run({ phase: "unsealed", warn: false }, [{ type: "close" }]);
    expect(shut.phase).toBe("closing");
    expect(run(shut, [{ type: "rest" }]).phase).toBe("closed");
    expect(run(shut, [{ type: "kdf" }]).phase).toBe("deriving");
  });

  it("restores the one-try warning from the stored attempt count", () => {
    expect(run(closed, [{ type: "warn", attemptsLeft: 1 }]).warn).toBe(true);
    expect(run(closed, [{ type: "warn", attemptsLeft: 4 }]).warn).toBe(false);
  });

  it("ignores stray signals", () => {
    expect(run(closed, [{ type: "rest" }])).toEqual(closed);
    expect(run({ phase: "sealed", warn: false }, [{ type: "kdf" }, { type: "fail" }]).phase).toBe("sealed");
    expect(run({ phase: "deriving", warn: false }, [{ type: "kdf" }]).phase).toBe("deriving");
  });
});
