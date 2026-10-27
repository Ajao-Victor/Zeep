// Where the Proof Gate's parts sit, in CSS pixels of the scene box. Every tier (poster, 2D canvas,
// WebGL) and the DOM labels read this, so they line up exactly.

export const LANES = ["Private AI", "Search", "Health", "Inbox"] as const;

/** Identity colours (styles/tokens.css --id-1..6); a canvas or shader can't read CSS variables. */
export const IDENTITY = ["#c9785d", "#7fa7c9", "#b58ac9", "#8fbf9a", "#c9b26a", "#c98aa6"] as const;
export const GOLD = "#d9a441";
export const ANON = "#f4f2ee";

export type SceneLayout = {
  width: number;
  height: number;
  gate: { x: number; y: number; r: number };
  /** Requests wander across this band before they funnel into the gate. */
  spread: { top: number; bottom: number };
  lanes: number[];
  laneStart: number;
  laneEnd: number;
  /** Right edge of the right-aligned lane labels. */
  labelRight: number;
};

/**
 * `reserveBottom` is the height covered by the glass panel at the bottom of the scene box.
 * The gate and lanes stay above it; requests still pass behind the glass.
 */
export function sceneLayout(width: number, height: number, reserveBottom = 0): SceneLayout {
  const narrow = width < 520;
  const top = height * 0.08;
  const bottom = Math.max(top + 120, height - reserveBottom - 20);
  const r = Math.min((bottom - top) * 0.4, width * (narrow ? 0.17 : 0.13));
  const gate = { x: width * (narrow ? 0.36 : 0.4), y: (top + bottom) / 2, r };
  const labelWidth = narrow ? 76 : 92;
  const lanes = LANES.map((_, index) => top + ((bottom - top) * (index + 0.5)) / LANES.length);
  return {
    width,
    height,
    gate,
    spread: { top: height * 0.04, bottom: height * 0.96 },
    lanes,
    laneStart: gate.x + r + 14,
    laneEnd: width - labelWidth - 18,
    labelRight: width - 12,
  };
}
