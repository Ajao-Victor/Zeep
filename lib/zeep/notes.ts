// Shielded balance notes. A user's balance is the sum of their unspent notes; the server
// never sees it. Each note is (rho, amount) with:
//   d = Poseidon(pk, rho)   commitment = Poseidon(d, amount)   nullifier = Poseidon(sk, rho)
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";
import { poseidon2 } from "poseidon-lite";
import { randomField } from "./field";
import type { ZeepKeys } from "./keys";

export interface Note {
  rho: string; // decimal
  amount: string; // zats, decimal
  tree: number;
  index: number;
  commitment: string;
  /** "deposit:<i>" for deposit notes, "change" for spend outputs. */
  origin: string;
  spent?: boolean;
  /** Locked while a spend that uses it is in flight. */
  pending?: boolean;
}

export const ownerTag = (pk: bigint, rho: bigint) => poseidon2([pk, rho]);
export const noteCommitment = (d: bigint, amount: bigint) => poseidon2([d, amount]);
export const nullifierOf = (sk: bigint, rho: bigint) => poseidon2([sk, rho]);

// ---- encrypted backups: base64(nonce[12] || AES-GCM(amount u64 BE || rho 32B)) ----
const toB64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function aes(key: Uint8Array) {
  return crypto.subtle.importKey("raw", new Uint8Array(key), "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptNote(noteKey: Uint8Array, amount: bigint, rho: bigint): Promise<string> {
  const pt = new Uint8Array(40);
  new DataView(pt.buffer).setBigUint64(0, amount);
  pt.set(hexToBytes(rho.toString(16).padStart(64, "0")), 8);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await aes(noteKey), pt));
  const out = new Uint8Array(12 + ct.length);
  out.set(iv);
  out.set(ct, 12);
  return toB64(out);
}

export async function decryptNote(noteKey: Uint8Array, enc: string): Promise<{ amount: bigint; rho: bigint } | null> {
  try {
    const raw = fromB64(enc);
    const pt = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: raw.slice(0, 12) }, await aes(noteKey), raw.slice(12)));
    return { amount: new DataView(pt.buffer).getBigUint64(0), rho: BigInt("0x" + bytesToHex(pt.slice(8, 40))) };
  } catch {
    return null; // not ours
  }
}

/** Same-length random bytes for a zero-value dummy output, so it looks like any other backup. */
export function dummyEnc(): string {
  return toB64(crypto.getRandomValues(new Uint8Array(12 + 40 + 16)));
}

/** A fresh output note owned by `keys` (or by `ownerPk`, e.g. an agent). */
export function newOutput(pk: bigint, amount: bigint) {
  const rho = randomField();
  const d = ownerTag(pk, rho);
  return { rho, d, amount, commitment: noteCommitment(d, amount) };
}

/** In-memory note book with balance and input selection. Persist with toJSON(). */
export class NoteBook {
  notes: Note[] = [];
  nextDeposit = 0;

  static from(json: { notes: Note[]; nextDeposit: number } | null | undefined): NoteBook {
    const b = new NoteBook();
    if (json) {
      b.notes = json.notes.map((n) => ({ ...n, pending: false }));
      b.nextDeposit = json.nextDeposit;
    }
    return b;
  }

  toJSON() {
    return { notes: this.notes.filter((n) => !n.spent), nextDeposit: this.nextDeposit };
  }

  /** Spendable balance in zats. */
  balance(): bigint {
    return this.notes.filter((n) => !n.spent && !n.pending).reduce((s, n) => s + BigInt(n.amount), 0n);
  }

  add(n: Note) {
    if (!this.notes.some((x) => x.commitment === n.commitment)) this.notes.push(n);
  }

  /**
   * Up to two unspent notes covering `cost`. Returns null if the balance is too low;
   * returns `{ merge: [a, b] }` if the money is spread over more notes than one spend can use.
   */
  select(cost: bigint): { inputs: Note[] } | { merge: [Note, Note] } | null {
    const free = this.notes.filter((n) => !n.spent && !n.pending && BigInt(n.amount) > 0n)
      .sort((a, b) => (BigInt(b.amount) > BigInt(a.amount) ? 1 : -1));
    const total = free.reduce((s, n) => s + BigInt(n.amount), 0n);
    if (total < cost) return null;
    const one = [...free].reverse().find((n) => BigInt(n.amount) >= cost);
    if (one) return { inputs: [one] };
    if (free.length >= 2 && BigInt(free[0].amount) + BigInt(free[1].amount) >= cost) return { inputs: [free[0], free[1]] };
    return { merge: [free[free.length - 1], free[free.length - 2]] };
  }
}

export function noteFromKeys(keys: ZeepKeys, rho: bigint, amount: bigint, tree: number, index: number, origin: string): Note {
  const d = ownerTag(keys.pk, rho);
  return { rho: rho.toString(), amount: amount.toString(), tree, index, commitment: noteCommitment(d, amount).toString(), origin };
}
