/// <reference lib="webworker" />

// WebZjs is vendored at /webzjs (webzjs_wallet.js, the wasm, and snippets/).
// ChainSafe publishes only @chainsafe/webzjs-keys on npm. The wallet package is
// built from https://github.com/ChainSafe/WebZjs at commit 8f0c0a0e (pinned)
// and copied into public/webzjs. This worker refuses to invent a balance when
// that build is not present.

type WalletRequest = {
  id: string;
  type: "summary" | "pay";
  phrase: string;
  network: "testnet" | "mainnet";
  url: string;
  to?: string;
  zats?: string;
};

type WalletModule = {
  initThreadPool: (threads: number) => Promise<void>;
  WebWallet: new (network: string, url: string, min: number, max: number) => WebWallet;
};

type WebWallet = {
  create_account: (name: string, phrase: string, account: number, birthday: number) => Promise<void>;
  sync: () => Promise<void>;
  get_wallet_summary: () => Promise<{ balances?: { total?: string | number } }>;
  get_current_address: (account: number) => Promise<string>;
  pczt_create: (account: number, to: string, zats: string) => Promise<unknown>;
  derive_from_seed: (phrase: string, account: number) => Promise<{ usk: unknown }>;
  pczt_sign: (pczt: unknown, usk: unknown) => Promise<unknown>;
  pczt_prove: (pczt: unknown) => Promise<unknown>;
  pczt_send: (pczt: unknown) => Promise<unknown>;
};

let wallet: WebWallet | null = null;
let opened = "";

async function loadModule(): Promise<WalletModule> {
  const moduleUrl = new URL("/webzjs/webzjs_wallet.js", self.location.origin).toString();
  const response = await fetch(moduleUrl, { method: "HEAD" }).catch(() => null);
  if (!response || !response.ok) {
    throw new Error("The in-app Zcash wallet build is not installed. Pay from another wallet with the QR.");
  }
  return import(/* webpackIgnore: true */ moduleUrl) as Promise<WalletModule>;
}

async function open(message: WalletRequest): Promise<WebWallet> {
  const key = `${message.network}:${message.url}`;
  if (wallet && opened === key) return wallet;
  if (!message.url) throw new Error("No lightwalletd URL is configured for this network.");
  const mod = await loadModule();
  await mod.initThreadPool(Math.min(4, navigator.hardwareConcurrency || 1));
  const chain = message.network === "mainnet" ? "main" : "test";
  const next = new mod.WebWallet(chain, message.url, 1, 1);
  await next.create_account("zeep", message.phrase, 0, 0);
  await next.sync();
  wallet = next;
  opened = key;
  return next;
}

self.onmessage = async (event: MessageEvent<WalletRequest>) => {
  const message = event.data;
  try {
    const current = await open(message);
    if (message.type === "summary") {
      const summary = await current.get_wallet_summary();
      const address = await current.get_current_address(0);
      const total = summary.balances?.total ?? 0;
      self.postMessage({ id: message.id, ok: true, zats: String(total), address });
      return;
    }
    const pczt = await current.pczt_create(0, message.to ?? "", message.zats ?? "0");
    const { usk } = await current.derive_from_seed(message.phrase, 0);
    const signed = await current.pczt_sign(pczt, usk);
    const proved = await current.pczt_prove(signed);
    await current.pczt_send(proved);
    self.postMessage({ id: message.id, ok: true });
  } catch (cause) {
    self.postMessage({ id: message.id, ok: false, error: cause instanceof Error ? cause.message : "The wallet failed." });
  }
};
