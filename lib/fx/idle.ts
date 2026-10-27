/**
 * Run `run` once the browser is idle (or after 200 ms where requestIdleCallback is missing), so
 * heavy scene chunks load after first paint. Returns a cancel function.
 */
export function whenIdle(run: () => void): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(run, { timeout: 1500 });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(run, 200);
  return () => window.clearTimeout(id);
}
