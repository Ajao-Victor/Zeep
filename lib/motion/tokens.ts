// Motion tokens for JavaScript (DOM animation and WebGL scenes). Durations and curves mirror
// styles/tokens.css; lib/motion/tokens.test.ts fails if the two drift apart.

/** Milliseconds. */
export const duration = {
  instant: 90,
  quick: 150,
  base: 240,
  slow: 420,
  cinematic: 900,
} as const;

/** Cubic-bezier control points, the shape Motion's `ease` option accepts. */
export const curve = {
  enter: [0.16, 1, 0.3, 1],
  move: [0.65, 0, 0.35, 1],
  exit: [0.7, 0, 0.84, 0],
} as const satisfies Record<string, readonly [number, number, number, number]>;

/** Spring presets, in the shape of Motion's spring transition. */
export const spring = {
  /** Toggles, chips, the PIN dots. */
  snappy: { type: "spring", stiffness: 500, damping: 38, mass: 1 },
  /** Panels, cards, the vault door. */
  weighty: { type: "spring", stiffness: 220, damping: 28, mass: 1.2 },
  /** Ambient drift in scenes. */
  float: { type: "spring", stiffness: 60, damping: 14, mass: 1 },
} as const;

/** Stagger between list items, capped so long lists don't drag. */
export const stagger = { step: 40, maxItems: 8 } as const;

export function staggerDelay(index: number): number {
  return Math.min(index, stagger.maxItems - 1) * stagger.step;
}

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
