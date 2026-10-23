import { describe, expect, it } from "vitest";
import { chooseTier, stepDown, type DeviceSignals } from "@/lib/fx/tier";

const desktop: DeviceSignals = {
  fxLevel: "auto",
  reducedMotion: false,
  saveData: false,
  webgl2: true,
  cores: 10,
  memoryGb: 16,
  coarsePointer: false,
  screenWidth: 1728,
};
const phone: DeviceSignals = { ...desktop, cores: 8, memoryGb: 4, coarsePointer: true, screenWidth: 390 };

describe("rendering tiers", () => {
  it("gives a strong desktop the full scene and a capable phone the standard one", () => {
    expect(chooseTier(desktop)).toBe(3);
    expect(chooseTier(phone)).toBe(2);
  });

  it("falls back to the still poster for reduced motion, data saver or FX off", () => {
    expect(chooseTier({ ...desktop, reducedMotion: true })).toBe(0);
    expect(chooseTier({ ...desktop, saveData: true })).toBe(0);
    expect(chooseTier({ ...desktop, fxLevel: "off" })).toBe(0);
  });

  it("uses the 2D canvas without WebGL2, on weak devices, or when FX is lite", () => {
    expect(chooseTier({ ...desktop, webgl2: false })).toBe(1);
    expect(chooseTier({ ...desktop, fxLevel: "lite" })).toBe(1);
    expect(chooseTier({ ...phone, memoryGb: 2 })).toBe(1);
    expect(chooseTier({ ...phone, cores: 4 })).toBe(1);
  });

  it("steps down one tier when the frame rate stays under the floor", () => {
    expect(stepDown(3, 42)).toBe(2);
    expect(stepDown(3, 58)).toBe(3);
    expect(stepDown(2, 24)).toBe(1);
    expect(stepDown(1, 5)).toBe(1);
  });
});
