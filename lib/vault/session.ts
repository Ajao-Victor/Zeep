import type { Session } from "@/lib/vault/types";
import { zero } from "@/lib/bytes";

let session: Session | null = null;
const listeners = new Set<() => void>();

export function readSession(): Session | null {
  return session;
}

export function setSession(next: Session | null) {
  if (session && session !== next) zero(session.seed);
  session = next;
  emit();
}

export function clearSession() {
  if (session) zero(session.seed);
  session = null;
  emit();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emit() {
  for (const listener of listeners) listener();
}
