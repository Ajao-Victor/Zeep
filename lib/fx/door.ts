// The Vault Door's phase machine. Driven only by real signals: the Argon2id worker's start/end
// edges (lib/vault/kdf.ts onKdf), the outcome of the vault call, and the lock / network-switch
// intent. Nothing here runs on a timer except `rest`, which ends an outcome once it has played.

export type DoorPhase =
  | "open" // the vault is not sealed yet (creating a vault, before the PIN is saved)
  | "sealing" // createVault is deriving the key and writing the vault
  | "sealed" // the new vault is saved
  | "closed" // locked, at rest
  | "closing" // the session was just cleared (lock, auto-lock, network switch)
  | "deriving" // unlock: Argon2id is running
  | "opening" // unlock succeeded
  | "unsealed" // the door has swung open; the next route takes over
  | "rejected" // wrong PIN
  | "wiped"; // five wrong PINs erased the vault

export type DoorSignal =
  | { type: "kdf" } // the worker started deriving
  | { type: "ok" }
  | { type: "fail"; attemptsLeft?: number; wiped?: boolean }
  | { type: "close" }
  | { type: "rest" }
  | { type: "warn"; attemptsLeft: number }; // the stored count, read on mount

export type DoorState = { phase: DoorPhase; warn: boolean };

/** How long an outcome plays before `rest`, in ms. Reduced motion uses 0 (see useVaultDoor). */
export const DOOR_HOLD: Partial<Record<DoorPhase, number>> = { opening: 900, rejected: 520, closing: 900 };

export function doorStep(state: DoorState, signal: DoorSignal): DoorState {
  const { phase } = state;
  switch (signal.type) {
    case "kdf":
      if (phase === "open") return { ...state, phase: "sealing" };
      if (phase === "closed" || phase === "rejected" || phase === "closing") return { ...state, phase: "deriving" };
      return state;
    case "ok":
      if (phase === "open" || phase === "sealing") return { ...state, phase: "sealed" };
      if (phase === "closed" || phase === "deriving" || phase === "rejected" || phase === "closing") return { phase: "opening", warn: false };
      return state;
    case "fail":
      if (phase === "sealing") return { ...state, phase: "open" };
      if (signal.wiped) return { phase: "wiped", warn: false };
      if (phase === "deriving" || phase === "closed" || phase === "rejected") {
        return { phase: "rejected", warn: state.warn || signal.attemptsLeft === 1 };
      }
      return state;
    case "close":
      return phase === "wiped" ? state : { ...state, phase: "closing" };
    case "rest":
      if (phase === "opening") return { ...state, phase: "unsealed" };
      if (phase === "rejected" || phase === "closing") return { ...state, phase: "closed" };
      return state;
    case "warn":
      return { ...state, warn: signal.attemptsLeft === 1 };
  }
}
