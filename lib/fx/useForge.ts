"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { FORGE_HOLD, forgeIdle, forgeStep, type ForgePhase } from "@/lib/fx/forge";
import { onProof } from "@/lib/zeep/prove";

/**
 * Drives a ProofButton from real state. Wrap the paid call in `track`: the phase follows the
 * call's promise and the prover's start/end edges while it runs. `track` returns the call's
 * result and rethrows its error, so the screen's own handling stays as it was.
 */
export function useForge(): { phase: ForgePhase; track: <T>(run: () => Promise<T>) => Promise<T> } {
  const [state, dispatch] = useReducer(forgeStep, forgeIdle);
  const rest = useRef(0);

  useEffect(() => () => window.clearTimeout(rest.current), []);

  const track = useCallback(async <T,>(run: () => Promise<T>): Promise<T> => {
    window.clearTimeout(rest.current);
    dispatch("pay");
    const off = onProof(dispatch);
    let outcome: "settled" | "failed" = "failed";
    try {
      const result = await run();
      // client.pay resolves with the raw Response, even for an error status.
      if (!(result instanceof Response) || result.ok) outcome = "settled";
      return result;
    } finally {
      off();
      dispatch(outcome === "settled" ? "ok" : "fail");
      rest.current = window.setTimeout(() => dispatch("rest"), FORGE_HOLD[outcome]);
    }
  }, []);

  return { phase: state.phase, track };
}
