/// <reference lib="webworker" />

// WebZjs is vendored at /webzjs (webzjs_wallet.js, the wasm, and snippets/).
// ChainSafe publishes only @chainsafe/webzjs-keys on npm. The wallet package is
// built from https://github.com/ChainSafe/WebZjs at commit 8f0c0a0e (pinned)
// and copied into public/webzjs. This worker refuses to invent a balance when
// that build is not present.
//
// Spends always come from the shielded pool. Transparent ZEC (from an exchange
// that cannot pay a unified address) is shielded with pczt_shield once it
// clears the minimum, then the next payment uses the shielded balance.

type WalletRequest = {
  id: string;
  type: "summary" | "pay";
  phrase: string;
  network: "testnet" | "mainnet";
  url: string;
  to?: string;
  zats?: string;
  minZats?: string;
  birthday?: number;
};

type WalletModule = {
  initThreadPool: (threads: number) => Promise<void>;
  WebWallet: new (network: string, url: string, min: number, max: number) => WebWallet;
};

type WebWallet = {
  create_account: (name: string, phrase: string, account: number, birthday: number) => Promise<void>;
  sync: () => Promise<void>;
  get_wallet_summary: () => Promise<unknown>;
  get_current_address: (account: number) => Promise<string>;
  get_current_address_transparent?: () => Promise<string>;
  pczt_create: (account: number, to: string, zats: string) => Promise<unknown>;
  pczt_shield?: (account: number) => Promise<unknown>;
  derive_from_seed: (phrase: string, account: number) => Promise<{ usk: unknown }>;
  pczt_sign: (pczt: unknown, usk: unknown) => Promise<unknown>;
  pczt_prove: (pczt: unknown) => Promise<unknown>;
  pczt_send: (pczt: unknown) => Promise<unknown>;
};

let wallet: WebWallet | null = null;
let opened = "";

function asZats(value: unknown): bigint {
  if (value == null) return 0n;
  if (typeof value === "bigint") return value;
  if (typeof value === "number" || typeof value === "string") {
    try {
      return BigInt(value);
    } catch {
      return 0n;
    }
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if ("zatoshis" in record) return asZats(record.zatoshis);
    if ("inner" in record) return asZats(record.inner);
  }
  return 0n;
}

function readPools(summary: unknown): { shielded: bigint; transparent: bigint } {
  const root = (summary ?? {}) as Record<string, unknown>;
  const accounts = (root.account_balances ?? root.accountBalances ?? root.balances) as unknown;
  let account: Record<string, unknown> = root;
  if (accounts && typeof accounts === "object") {
    const values = Array.isArray(accounts) ? accounts : Object.values(accounts as Record<string, unknown>);
    const first = values.find((item) => item && typeof item === "object");
    if (first && typeof first === "object") account = first as Record<string, unknown>;
  }
  const orchard = asZats(account.spendable_orchard_balance ?? account.orchard_balance ?? account.orchard);
  const sapling = asZats(account.spendable_sapling_balance ?? account.sapling_balance ?? account.sapling);
  const transparent = asZats(account.unshielded ?? account.transparent_balance ?? account.transparent);
  if (orchard + sapling + transparent > 0n) return { shielded: orchard + sapling, transparent };
  return { shielded: asZats(root.total ?? (root.balances as { total?: unknown } | undefined)?.total), transparent: 0n };
}

async function loadModule(): Promise<WalletModule> {
  const moduleUrl = new URL("/webzjs/webzjs_wallet.js", self.location.origin).toString();
  const response = await fetch(moduleUrl, { method: "HEAD" }).catch(() => null);
  if (!response || !response.ok) {
    throw new Error("The in-app Zcash wallet build is not installed. Pay from another wallet with the QR.");
  }
  return import(/* webpackIgnore: true */ moduleUrl) as Promise<WalletModule>;
}

async function open(message: WalletRequest): Promise<WebWallet> {
  const key = `${message.network}:${message.url}:${message.birthday ?? 0}`;
  if (wallet && opened === key) return wallet;
  if (!message.url) throw new Error("No lightwalletd URL is configured for this network.");
  const mod = await loadModule();
  await mod.initThreadPool(Math.min(4, navigator.hardwareConcurrency || 1));
  const chain = message.network === "mainnet" ? "main" : "test";
  const next = new mod.WebWallet(chain, message.url, 1, 1);
  await next.create_account("zeep", message.phrase, 0, message.birthday ?? 0);
  await next.sync();
  wallet = next;
  opened = key;
  return next;
}

async function shield(current: WebWallet, phrase: string): Promise<void> {
  if (!current.pczt_shield) return;
  const pczt = await current.pczt_shield(0);
  const { usk } = await current.derive_from_seed(phrase, 0);
  const signed = await current.pczt_sign(pczt, usk);
  const proved = await current.pczt_prove(signed);
  await current.pczt_send(proved);
  await current.sync();
}

async function snapshot(current: WebWallet, phrase: string, min: bigint) {
  await current.sync();
  const summary = await current.get_wallet_summary();
  const height = chainHeight(summary);
  let pools = readPools(summary);
  let shielding = false;
  if (pools.transparent >= min && current.pczt_shield) {
    shielding = true;
    try {
      await shield(current, phrase);
      pools = readPools(await current.get_wallet_summary());
      shielding = pools.transparent >= min;
    } catch {
      shielding = true;
    }
  }
  const unified = await current.get_current_address(0);
  let transparentAddress = "";
  if (current.get_current_address_transparent) {
    transparentAddress = await current.get_current_address_transparent().catch(() => "");
  }
  return {
    shieldedZats: pools.shielded.toString(),
    transparentZats: pools.transparent.toString(),
    unified,
    transparentAddress,
    shielding,
    height,
  };
}

function chainHeight(summary: unknown): number {
  const root = (summary ?? {}) as Record<string, unknown>;
  const raw = root.chain_tip_height ?? root.fully_scanned_height ?? root.chainTipHeight;
  const height = Number(raw);
  return Number.isFinite(height) ? height : 0;
}

self.onmessage = async (event: MessageEvent<WalletRequest>) => {
  const message = event.data;
  try {
    const current = await open(message);
    const min = BigInt(message.minZats || "100000");
    if (message.type === "summary") {
      const view = await snapshot(current, message.phrase, min);
      self.postMessage({ id: message.id, ok: true, ...view });
      return;
    }
    const view = await snapshot(current, message.phrase, min);
    const need = BigInt(message.zats || "0");
    if (BigInt(view.shieldedZats) < need) {
      throw new Error(
        view.shielding
          ? "Shielded funds are short. Transparent ZEC is shielding; try the payment again after the next sync."
          : "The shielded balance cannot cover this payment.",
      );
    }
    const pczt = await current.pczt_create(0, message.to ?? "", message.zats ?? "0");
    const { usk } = await current.derive_from_seed(message.phrase, 0);
    const signed = await current.pczt_sign(pczt, usk);
    const proved = await current.pczt_prove(signed);
    await current.pczt_send(proved);
    self.postMessage({ id: message.id, ok: true, ...view });
  } catch (cause) {
    self.postMessage({ id: message.id, ok: false, error: cause instanceof Error ? cause.message : "The wallet failed." });
  }
};
