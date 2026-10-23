// Why the vault just closed, handed from the code that cleared the session to /unlock, which
// plays the Vault Door closing and says why in text. In-memory only: it carries no secret, and a
// reload (which locks anyway) simply shows the door at rest.

import type { Network } from "@/lib/config";

export type DoorIntent =
  | { reason: "lock" }
  | { reason: "idle" }
  | { reason: "hidden" }
  | { reason: "switch"; network: Network };

let pending: DoorIntent | null = null;

/** Call only after the session has been cleared: the door never stands in for the real lock. */
export function setDoorIntent(intent: DoorIntent) {
  pending = intent;
}

/** Read without clearing, so a double-invoked render (React strict mode) sees the same value. */
export function peekDoorIntent(): DoorIntent | null {
  return pending;
}

export function clearDoorIntent() {
  pending = null;
}

export function doorIntentText(intent: DoorIntent): string {
  switch (intent.reason) {
    case "lock":
      return "Locked. The key was cleared from this tab.";
    case "idle":
      return "Locked after inactivity.";
    case "hidden":
      return "Locked because this tab was hidden.";
    case "switch":
      return `Switched to ${intent.network}. Its vault has its own PIN.`;
  }
}
