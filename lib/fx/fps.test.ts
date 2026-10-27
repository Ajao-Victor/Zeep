import { describe, expect, it } from "vitest";
import { createFpsSampler, FPS_WARMUP_S, FPS_WINDOW_S } from "@/lib/fx/fps";

// Feed `seconds` of frames at `fps` into a sampler. A small margin makes sure the warm-up or window
// boundary is crossed despite floating-point sums (240 × 1/60 is just under 4).
const MARGIN = 0.05;
function run(sample: (delta: number) => void, fps: number, seconds: number) {
  for (let index = 0; index < Math.round(fps * (seconds + MARGIN)); index += 1) sample(1 / fps);
}

describe("fps sampler", () => {
  it("ignores the start-up seconds", () => {
    const reports: number[] = [];
    const sample = createFpsSampler((fps) => reports.push(fps));
    run(sample, 20, FPS_WARMUP_S - 2 * MARGIN);
    expect(reports).toEqual([]);
  });

  it("reports only after two full windows, as the better of the two", () => {
    const reports: number[] = [];
    const sample = createFpsSampler((fps) => reports.push(fps));
    run(sample, 60, FPS_WARMUP_S);
    run(sample, 20, FPS_WINDOW_S);
    expect(reports).toEqual([]);
    run(sample, 60, FPS_WINDOW_S);
    expect(reports).toHaveLength(1);
    expect(reports[0]).toBeGreaterThan(55);
  });

  it("lets a drop through only when it lasts two windows in a row", () => {
    const reports: number[] = [];
    const sample = createFpsSampler((fps) => reports.push(fps));
    run(sample, 60, FPS_WARMUP_S + FPS_WINDOW_S);
    run(sample, 20, FPS_WINDOW_S);
    expect(reports.at(-1)).toBeGreaterThan(55);
    run(sample, 20, FPS_WINDOW_S);
    expect(reports.at(-1)).toBeLessThan(25);
  });

  it("restarts the window after a pause", () => {
    const reports: number[] = [];
    const sample = createFpsSampler((fps) => reports.push(fps));
    run(sample, 60, FPS_WARMUP_S + FPS_WINDOW_S);
    run(sample, 60, FPS_WINDOW_S - 0.6);
    sample(2);
    run(sample, 60, 1);
    expect(reports).toEqual([]);
  });
});
