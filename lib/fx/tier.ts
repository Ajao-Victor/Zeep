// Rendering tiers for scenes (design spec, section 5):
//   0 Still    static poster, no animation
//   1 Lite     2D canvas
//   2 Standard WebGL, fewer particles, capped pixel ratio
//   3 Ultra    WebGL, more particles, trails, full pixel ratio
import type { FxLevel } from "@/lib/config";

export type Tier = 0 | 1 | 2 | 3;

export type DeviceSignals = {
  fxLevel: FxLevel;
  reducedMotion: boolean;
  saveData: boolean;
  /** A hardware-accelerated WebGL2 context is available. */
  webgl2: boolean;
  cores: number;
  /** navigator.deviceMemory in GB; null where the browser doesn't expose it. */
  memoryGb: number | null;
  coarsePointer: boolean;
  screenWidth: number;
};

export function chooseTier(s: DeviceSignals): Tier {
  if (s.fxLevel === "off" || s.reducedMotion || s.saveData) return 0;
  if (s.fxLevel === "lite" || !s.webgl2) return 1;
  if ((s.memoryGb !== null && s.memoryGb <= 2) || (s.coarsePointer && s.cores <= 4)) return 1;
  const desktop = !s.coarsePointer && s.screenWidth >= 1024;
  if (desktop && s.cores >= 8 && (s.memoryGb === null || s.memoryGb >= 8)) return 3;
  return 2;
}

/** Below this sustained frame rate a WebGL tier steps down one level. */
export const FPS_FLOOR: Record<2 | 3, number> = { 3: 50, 2: 30 };

export function stepDown(tier: Tier, fps: number): Tier {
  if (tier === 3 && fps < FPS_FLOOR[3]) return 2;
  if (tier === 2 && fps < FPS_FLOOR[2]) return 1;
  return tier;
}

function hasWebgl2(): boolean {
  try {
    const canvas = document.createElement("canvas");
    // A software renderer (failIfMajorPerformanceCaveat) counts as no WebGL2.
    const gl = canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: true });
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export function readSignals(fxLevel: FxLevel): DeviceSignals {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  return {
    fxLevel,
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    saveData: Boolean(nav.connection?.saveData),
    webgl2: hasWebgl2(),
    cores: nav.hardwareConcurrency || 2,
    memoryGb: typeof nav.deviceMemory === "number" ? nav.deviceMemory : null,
    coarsePointer: window.matchMedia("(pointer: coarse)").matches,
    screenWidth: window.screen?.width || window.innerWidth,
  };
}
