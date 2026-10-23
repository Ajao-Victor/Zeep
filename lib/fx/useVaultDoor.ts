"use client";

import { useCallback, useEffect, useReducer } from "react";
import { DOOR_HOLD, doorStep, type DoorPhase, type DoorSignal } from "@/lib/fx/door";
import { prefersReducedMotion } from "@/lib/motion/tokens";
import { onKdf } from "@/lib/vault/kdf";

type Outcome = { attemptsLeft?: unknown; wiped?: unknown };

/**
 * Drives a VaultDoor from real state. Wrap the vault call (unlockWithPin, createVault, …) in
 * `track`: the rings turn when the Argon2id worker starts, and the call's outcome opens, seals,
 * rejects or wipes. `track` returns the result and rethrows the error, so the flow's own error
 * handling stays as it was. Outcomes play for DOOR_HOLD (none under reduced motion), then rest.
 */
export function useVaultDoor(initial: DoorPhase) {
  const [state, dispatch] = useReducer(doorStep, { phase: initial, warn: false });

  useEffect(() => {
    const hold = DOOR_HOLD[state.phase];
    if (hold === undefined) return;
    const timer = window.setTimeout(() => dispatch({ type: "rest" }), prefersReducedMotion() ? 0 : hold);
    return () => window.clearTimeout(timer);
  }, [state.phase]);

  const track = useCallback(async <T,>(run: () => Promise<T>): Promise<T> => {
    const off = onKdf((event) => {
      if (event === "start") dispatch({ type: "kdf" });
    });
    try {
      const result = await run();
      dispatch({ type: "ok" });
      return result;
    } catch (cause) {
      // PinError carries attemptsLeft and wiped; anything else is a plain failure.
      const outcome = (cause ?? {}) as Outcome;
      dispatch({
        type: "fail",
        attemptsLeft: typeof outcome.attemptsLeft === "number" ? outcome.attemptsLeft : undefined,
        wiped: outcome.wiped === true,
      });
      throw cause;
    } finally {
      off();
    }
  }, []);

  const signal = useCallback((next: DoorSignal) => dispatch(next), []);

  return { phase: state.phase, warn: state.warn, track, signal };
}
