// The Forge's phase machine: which stage of a paid request a ProofButton shows. Driven only by
// real signals (the button's own promise and the prover's start/end edges), never by timers.

export type ForgePhase = "idle" | "preparing" | "proving" | "sending" | "settled" | "failed";

/**
 * - `pay`: the button's handler started its paid call.
 * - `start` / `end`: the prover took or returned a proof (lib/zeep/prove.ts onProof).
 * - `ok` / `fail`: the paid call resolved with an OK response, or rejected.
 * - `rest`: the settled or failed state has been shown; return to idle.
 */
export type ForgeSignal = "pay" | "start" | "end" | "ok" | "fail" | "rest";

export type ForgeState = { phase: ForgePhase; proofs: number };

export const forgeIdle: ForgeState = { phase: "idle", proofs: 0 };

/** How long the outcome stays on the button before it returns to idle, in ms. */
export const FORGE_HOLD = { settled: 1400, failed: 900 } as const;

const inFlight = (phase: ForgePhase) => phase === "preparing" || phase === "proving" || phase === "sending";

export function forgeStep(state: ForgeState, signal: ForgeSignal): ForgeState {
  switch (signal) {
    case "pay":
      return { phase: "preparing", proofs: 0 };
    case "start":
      // One click can prove more than once (merge, refill, then the spend): each one spins again.
      return inFlight(state.phase) ? { phase: "proving", proofs: state.proofs + 1 } : state;
    case "end": {
      if (state.phase !== "proving") return state;
      const proofs = Math.max(0, state.proofs - 1);
      return { phase: proofs ? "proving" : "sending", proofs };
    }
    case "ok":
      return inFlight(state.phase) ? { phase: "settled", proofs: 0 } : state;
    case "fail":
      return inFlight(state.phase) ? { phase: "failed", proofs: 0 } : state;
    case "rest":
      return state.phase === "settled" || state.phase === "failed" ? forgeIdle : state;
  }
}
