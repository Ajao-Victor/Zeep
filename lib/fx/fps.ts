/** Seconds of frames ignored after a scene starts: page start-up, chunk evaluation, the other scene. */
export const FPS_WARMUP_S = 4;
/** Length of one measuring window, in seconds. */
export const FPS_WINDOW_S = 2;

/**
 * Samples a scene's sustained frame rate for the tier step-down (lib/fx/tier.ts stepDown).
 * Call the returned function with each frame's delta (R3F useFrame). After a warm-up it measures
 * 2 s windows and reports the better of the last two, so only a drop that lasts two windows in a
 * row can step a scene down; a single slow window (a GC, another tab, a scroll burst) can't.
 * A long frame (over 0.5 s: a paused loop or a hidden tab) restarts the current window.
 */
export function createFpsSampler(report: (fps: number) => void): (delta: number) => void {
  let warm = 0;
  let frames = 0;
  let time = 0;
  let previous: number | null = null;
  return (delta) => {
    if (delta > 0.5) {
      frames = 0;
      time = 0;
      return;
    }
    if (warm < FPS_WARMUP_S) {
      warm += delta;
      return;
    }
    frames += 1;
    time += delta;
    if (time < FPS_WINDOW_S) return;
    const fps = frames / time;
    frames = 0;
    time = 0;
    if (previous !== null) report(Math.max(previous, fps));
    previous = fps;
  };
}
