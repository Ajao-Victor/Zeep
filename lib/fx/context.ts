/** How long a lost WebGL context gets to come back before a scene gives up on WebGL. */
export const CONTEXT_GRACE_MS = 3000;

/**
 * Watches a scene's canvas for WebGL context loss. The GPU can drop a context for a moment (memory
 * pressure with two scenes on integrated graphics, a GPU process restart); calling preventDefault
 * asks the browser to restore it, and three.js rebuilds its state when it does. Only if it isn't
 * back within `graceMs` does `onLost` run (the scene then falls back to a CSS or 2D tier).
 * Returns a function that stops watching.
 */
export function watchContextLoss(canvas: HTMLCanvasElement, onLost: () => void, graceMs = CONTEXT_GRACE_MS): () => void {
  let timer = 0;
  const lost = (event: Event) => {
    event.preventDefault();
    window.clearTimeout(timer);
    timer = window.setTimeout(onLost, graceMs);
  };
  const restored = () => window.clearTimeout(timer);
  canvas.addEventListener("webglcontextlost", lost);
  canvas.addEventListener("webglcontextrestored", restored);
  return () => {
    window.clearTimeout(timer);
    canvas.removeEventListener("webglcontextlost", lost);
    canvas.removeEventListener("webglcontextrestored", restored);
  };
}
