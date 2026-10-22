import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { curve, duration, staggerDelay } from "@/lib/motion/tokens";

const css = fs.readFileSync(path.resolve(__dirname, "../../styles/tokens.css"), "utf8");
const root = css.slice(0, css.indexOf("@media"));

function token(name: string): string {
  const match = root.match(new RegExp(`--${name}:\\s*([^;]+);`));
  if (!match) throw new Error(`--${name} is missing from styles/tokens.css`);
  return match[1].trim();
}

describe("motion tokens", () => {
  it("match the CSS durations", () => {
    for (const [name, ms] of Object.entries(duration)) {
      expect(token(`dur-${name}`)).toBe(`${ms}ms`);
    }
  });

  it("match the CSS curves", () => {
    for (const [name, points] of Object.entries(curve)) {
      expect(token(`curve-${name}`)).toBe(`cubic-bezier(${points.join(", ")})`);
    }
  });

  it("caps the stagger at eight items", () => {
    expect(staggerDelay(0)).toBe(0);
    expect(staggerDelay(3)).toBe(120);
    expect(staggerDelay(20)).toBe(280);
  });
});
