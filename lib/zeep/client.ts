// ZeepClient: the user's private balance against one Zeep API (testnet or mainnet).
// Holds the note book and tree caches; pays for requests, deposits, withdraws, restores.
import { nullifierOf, decryptNote, noteFromKeys, NoteBook, type Note } from "./notes";
import { depositSlot, type ZeepKeys } from "./keys";
import { notesSignal, randomField, requestSignal, withdrawSignal } from "./field";
import { buildSpend, DEPTH, type Paths, type ProveFn } from "./spend";
import { MerkleTree } from "./tree";

export class ZeepApiError extends Error {
  constructor(message: string, readonly status: number, readonly code: string, readonly body: unknown) {
    super(message);
  }
}

export interface DepositStatus {
  intent_id: string;
  status: "waiting" | "confirming" | "credited" | "expired";
  address: string;
  expected_zats: number | null;
  credited: { amount_zats: number; tree: number; index: number } | null;
  confirming: { amount_zats: number; confirmations: number; needed: number }[];
  unclaimed_zats: number;
  expires_at: string;
}

interface TreeCache {
  tree: MerkleTree;
  enc: (string | null)[];
  root: bigint;
  closed: boolean;
}

export interface ClientOptions {
  baseUrl: string;
  keys: ZeepKeys;
  book: NoteBook;
  prove: ProveFn;
  fetch?: typeof fetch;
  /** Called whenever notes change, so the app can persist the book (encrypted). */
  onChange?: (book: NoteBook) => void | Promise<void>;
}

const b64json = (v: unknown) => {
  const bytes = new TextEncoder().encode(JSON.stringify(v));
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};

export class ZeepClient {
  readonly keys: ZeepKeys;
  readonly book: NoteBook;
  private trees = new Map<number, TreeCache>();
  private base: string;
  private f: typeof fetch;
  private busy: Promise<unknown> = Promise.resolve();

  constructor(private o: ClientOptions) {
    this.keys = o.keys;
    this.book = o.book;
    this.base = o.baseUrl.replace(/\/$/, "");
    this.f = o.fetch ?? fetch.bind(globalThis);
  }

  balance(): bigint {
    return this.book.balance();
  }

  // ---------------------------------------------------------------- http
  async api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await this.f(`${this.base}${path}`, { credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store", ...init });
    const text = await res.text();
    let body: any = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    if (!res.ok) {
      throw new ZeepApiError(body?.error?.message ?? `HTTP ${res.status}`, res.status, body?.error?.code ?? "http", body);
    }
    return body as T;
  }

  private json(method: string, body: unknown): RequestInit {
    return { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
  }

  config() {
    return this.api<any>("/v1/config");
  }
  prices() {
    return this.api<any>("/v1/prices");
  }

  // ---------------------------------------------------------------- trees
  private async syncTree(id: number): Promise<TreeCache> {
    let t = this.trees.get(id);
    if (!t) {
      t = { tree: new MerkleTree(DEPTH), enc: [], root: 0n, closed: false };
      this.trees.set(id, t);
    }
    if (t.closed) return t;
    for (;;) {
      const r = await this.api<{ leaves: { c: string; e: string | null }[]; root: string; total: number; closed: boolean }>(
        `/v1/trees/${id}/leaves?from=${t.tree.size}`,
      );
      const leaves = r.leaves.map((l) => BigInt(l.c));
      if (leaves.length) {
        const all: bigint[] = [];
        for (let i = 0; i < t.tree.size; i++) all.push(t.tree.leaf(i)!);
        t.tree.load(all.concat(leaves));
        t.enc.push(...r.leaves.map((l) => l.e));
      }
      t.closed = r.closed;
      t.root = BigInt(r.root);
      if (t.tree.size >= r.total || !r.leaves.length) break;
    }
    return t;
  }

  private async syncAll(): Promise<{ current: number; trees: number[] }> {
    const cfg = await this.config();
    const ids: number[] = [...cfg.trees.closed.map((t: { id: number }) => t.id), cfg.trees.current.id];
    for (const id of ids) await this.syncTree(id);
    return { current: cfg.trees.current.id, trees: ids };
  }

  private paths(current: number): Paths {
    return {
      path: (tree, index) => {
        const t = this.trees.get(tree);
        if (!t || index >= t.tree.size) throw new Error("note not synced");
        return { ...t.tree.path(index), root: t.tree.root() };
      },
      anyRoot: () => this.trees.get(current)!.tree.root(),
    };
  }

  // ---------------------------------------------------------------- spends
  /** Serialize spends: a note can only be in one spend at a time. */
  private exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.busy.then(fn, fn);
    this.busy = run.catch(() => {});
    return run;
  }

  private async changed() {
    await this.o.onChange?.(this.book);
  }

  private adoptOutputs(header: string | null, built: { change: { rho: bigint; amount: bigint } }, inputs: Note[]) {
    if (!header) return false;
    const [tree, idx] = header.split(":");
    const [i0] = idx.split(",").map(Number);
    for (const n of inputs) n.spent = true;
    if (built.change.amount > 0n) this.book.add(noteFromKeys(this.keys, built.change.rho, built.change.amount, Number(tree), i0, "change"));
    return true;
  }

  /**
   * Prepare inputs for `cost`, merging notes first if the money is spread too thin.
   * Returns the inputs (locked) and the synced current tree id.
   */
  private async prepare(cost: bigint): Promise<{ inputs: Note[]; current: number }> {
    for (let i = 0; i < 8; i++) {
      const { current } = await this.syncAll();
      const pick = this.book.select(cost);
      if (!pick) throw new ZeepApiError(`Not enough balance: this needs ${cost} zats, you have ${this.book.balance()}.`, 402, "insufficient", null);
      if ("inputs" in pick) {
        pick.inputs.forEach((n) => (n.pending = true));
        return { inputs: pick.inputs, current };
      }
      await this.mergeNow(pick.merge, current);
    }
    throw new Error("could not gather enough notes; try again");
  }

  private async mergeNow(notes: Note[], current: number) {
    notes.forEach((n) => (n.pending = true));
    try {
      const built = await buildSpend(this.keys, { inputs: notes, cost: 0n, signal: notesSignal() }, this.paths(current), this.o.prove);
      const res = await this.f(`${this.base}/v1/notes/spend`, this.json("POST", { proof: built.bundle }));
      if (!res.ok) throw new ZeepApiError(`merge failed: HTTP ${res.status}`, res.status, "merge", await res.text());
      this.adoptOutputs(res.headers.get("x-zeep-notes"), built, notes);
      await this.changed();
    } finally {
      notes.forEach((n) => (n.pending = false));
    }
  }

  /**
   * Pay for one API request and send it. `body` must be the exact string sent.
   * `minCostZats` comes from /v1/prices (a fresh quote is always accepted).
   * Returns the raw Response (JSON or an SSE stream).
   */
  pay(method: string, path: string, body: string, minCostZats: bigint, extraHeaders: Record<string, string> = {}): Promise<Response> {
    return this.exclusive(async () => {
      const { inputs, current } = await this.prepare(minCostZats);
      try {
        const built = await buildSpend(this.keys, { inputs, cost: minCostZats, signal: requestSignal(method, path, body) }, this.paths(current), this.o.prove);
        const headers: Record<string, string> = { "content-type": "application/json", ...extraHeaders };
        const b64 = b64json(built.bundle);
        for (let i = 0, n = 0; i < b64.length; i += 7000, n++) headers[n ? `x-zeep-proof-${n}` : "x-zeep-proof"] = b64.slice(i, i + 7000);
        let res: Response;
        try {
          res = await this.f(`${this.base}${path}`, { method, headers, body, credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store" });
        } catch (e) {
          await this.reconcile(inputs, built);
          throw e;
        }
        const adopted = this.adoptOutputs(res.headers.get("x-zeep-notes"), built, inputs);
        if (!res.ok) {
          const body = await res.clone().json().catch(() => null);
          const comp = body?.error?.compensation as { tree: number; index: number } | undefined;
          if (comp) this.book.add(noteFromKeys(this.keys, built.refund.rho, built.refund.amount, comp.tree, comp.index, "change"));
          if (!adopted && res.status === 409) await this.refreshSpent();
        }
        await this.changed();
        return res;
      } finally {
        inputs.forEach((n) => (n.pending = false));
      }
    });
  }

  /** After a network error we can't tell if the spend landed: look for our outputs in the tree. */
  private async reconcile(inputs: Note[], built: { change: { rho: bigint; amount: bigint; commitment: bigint } }) {
    const { trees } = await this.syncAll();
    for (const id of trees) {
      const t = this.trees.get(id)!;
      for (let i = t.tree.size - 1; i >= Math.max(0, t.tree.size - 2000); i--) {
        if (t.tree.leaf(i) === built.change.commitment) {
          inputs.forEach((n) => (n.spent = true));
          if (built.change.amount > 0n) this.book.add(noteFromKeys(this.keys, built.change.rho, built.change.amount, id, i, "change"));
          await this.changed();
          return;
        }
      }
    }
  }

  // ---------------------------------------------------------------- deposits
  /** Reserve a fresh deposit address. The user can send any amount to it, from any wallet. */
  async startDeposit(expectedZats?: bigint, claimFrom?: string): Promise<DepositStatus & { slot: number }> {
    const slot = this.book.nextDeposit;
    const { intentId, d } = depositSlot(this.keys, slot);
    const st = await this.api<DepositStatus>("/v1/deposits", this.json("POST", {
      intent_id: intentId, d: d.toString(), expected_zats: expectedZats ? Number(expectedZats) : undefined, claim_from: claimFrom,
    }));
    this.book.nextDeposit = slot + 1;
    await this.changed();
    return { ...st, slot };
  }

  /** Poll a deposit; credits the note into the book when it lands. */
  async depositStatus(slot: number): Promise<DepositStatus> {
    const { intentId, rho } = depositSlot(this.keys, slot);
    const st = await this.api<DepositStatus>(`/v1/deposits/${intentId}`);
    if (st.credited) {
      this.book.add(noteFromKeys(this.keys, rho, BigInt(st.credited.amount_zats), st.credited.tree, st.credited.index, `deposit:${slot}`));
      await this.changed();
    }
    if (st.unclaimed_zats > 0) await this.startDeposit(undefined, intentId); // money sent twice to one address
    return st;
  }

  // ---------------------------------------------------------------- withdrawals
  withdraw(amountZats: bigint, payoutAddress: string): Promise<any> {
    return this.exclusive(async () => {
      const id = crypto.randomUUID();
      const { inputs, current } = await this.prepare(amountZats);
      try {
        const built = await buildSpend(this.keys, { inputs, cost: amountZats, signal: withdrawSignal(id, payoutAddress) }, this.paths(current), this.o.prove);
        delete built.bundle.compensate;
        const res = await this.f(`${this.base}/v1/withdrawals`, this.json("POST", { withdrawal_id: id, payout_address: payoutAddress, proof: built.bundle }));
        const body = await res.json().catch(() => null);
        this.adoptOutputs(res.headers.get("x-zeep-notes"), built, inputs);
        await this.changed();
        if (!res.ok) throw new ZeepApiError(body?.error?.message ?? `HTTP ${res.status}`, res.status, body?.error?.code ?? "http", body);
        return body;
      } finally {
        inputs.forEach((n) => (n.pending = false));
      }
    });
  }

  withdrawalStatus(id: string) {
    return this.api<any>(`/v1/withdrawals/${id}`);
  }

  /** Send zats to another Zeep key. The second output is theirs; this spend costs nothing. */
  fund(pk: bigint, amountZats: bigint, noteKey?: Uint8Array): Promise<void> {
    return this.exclusive(async () => {
      const { inputs, current } = await this.prepare(amountZats);
      try {
        const built = await buildSpend(
          this.keys,
          { inputs, cost: 0n, signal: notesSignal(), transfer: { pk, amount: amountZats, noteKey } },
          this.paths(current),
          this.o.prove,
        );
        const res = await this.f(`${this.base}/v1/notes/spend`, this.json("POST", { proof: built.bundle }));
        if (!res.ok) throw new ZeepApiError(`transfer failed: HTTP ${res.status}`, res.status, "transfer", await res.text());
        this.adoptOutputs(res.headers.get("x-zeep-notes"), built, inputs);
        await this.changed();
      } finally {
        inputs.forEach((n) => (n.pending = false));
      }
    });
  }

  // ---------------------------------------------------------------- restore / sync
  /** Mark notes another device already spent. Mixes in decoys so the query reveals less. */
  async refreshSpent(): Promise<void> {
    const mine = this.book.notes.filter((n) => !n.spent);
    if (!mine.length) return;
    const real = mine.map((n) => nullifierOf(this.keys.sk, BigInt(n.rho)).toString());
    const decoys = Array.from({ length: Math.max(8, real.length) }, () => randomField().toString());
    const all = [...real, ...decoys].sort(() => Math.random() - 0.5);
    const r = await this.api<{ spent: boolean[] }>("/v1/nullifiers/check", this.json("POST", { nullifiers: all }));
    const spent = new Set(all.filter((_, i) => r.spent[i]));
    mine.forEach((n, i) => {
      if (spent.has(real[i])) n.spent = true;
    });
    await this.changed();
  }

  /**
   * Rebuild the note book from the recovery phrase alone: trial-decrypt every backup in
   * every tree, re-find deposits, then drop what's already spent.
   */
  async restore(onProgress?: (msg: string) => void): Promise<bigint> {
    const { trees } = await this.syncAll();
    for (const id of trees) {
      const t = this.trees.get(id)!;
      onProgress?.(`Scanning ${t.tree.size} notes in tree ${id}`);
      for (let i = 0; i < t.enc.length; i++) {
        const e = t.enc[i];
        if (!e) continue;
        const n = await decryptNote(this.keys.noteKey, e);
        if (!n) continue;
        const note = noteFromKeys(this.keys, n.rho, n.amount, id, i, "change");
        if (BigInt(note.commitment) === t.tree.leaf(i) && n.amount > 0n) this.book.add(note);
      }
    }
    onProgress?.("Finding deposits");
    let misses = 0;
    for (let slot = 0; misses < 5; slot++) {
      try {
        await this.depositStatus(slot);
        this.book.nextDeposit = Math.max(this.book.nextDeposit, slot + 1);
        misses = 0;
      } catch (e) {
        if (e instanceof ZeepApiError && e.status === 404) misses++;
        else throw e;
      }
    }
    onProgress?.("Checking spent notes");
    await this.refreshSpent();
    this.book.notes = this.book.notes.filter((n) => !n.spent);
    await this.changed();
    return this.book.balance();
  }
}
