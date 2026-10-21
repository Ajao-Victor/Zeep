export type Network = "testnet" | "mainnet";

function asNetwork(value: string | undefined): Network {
  return value === "mainnet" ? "mainnet" : "testnet";
}

function asNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asFlag(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") return fallback;
  return value === "true" || value === "1";
}

export const config = {
  appName: process.env.NEXT_PUBLIC_APP_NAME || "Zeep",
  appUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  defaultNetwork: asNetwork(process.env.NEXT_PUBLIC_DEFAULT_NETWORK),
  apiBase: {
    testnet: process.env.NEXT_PUBLIC_API_BASE_URL_TESTNET || "",
    mainnet: process.env.NEXT_PUBLIC_API_BASE_URL_MAINNET || "",
  },
  onionApi: {
    testnet: process.env.NEXT_PUBLIC_ONION_API_URL_TESTNET || "",
    mainnet: process.env.NEXT_PUBLIC_ONION_API_URL_MAINNET || "",
  },
  enableFrontierOnTestnet: asFlag(process.env.NEXT_PUBLIC_ENABLE_FRONTIER_ON_TESTNET, false),
  spendWasmUrl: process.env.NEXT_PUBLIC_SPEND_WASM_URL || "/circuits/zeep_spend.wasm",
  spendWasmSha256: (process.env.NEXT_PUBLIC_SPEND_WASM_SHA256 || "").toLowerCase(),
  spendZkeyUrl: process.env.NEXT_PUBLIC_SPEND_ZKEY_URL || "/circuits/zeep_spend.zkey",
  spendZkeySha256: (process.env.NEXT_PUBLIC_SPEND_ZKEY_SHA256 || "").toLowerCase(),
  lightwalletd: {
    testnet: process.env.NEXT_PUBLIC_LIGHTWALLETD_URL_TESTNET || "",
    mainnet: process.env.NEXT_PUBLIC_LIGHTWALLETD_URL_MAINNET || "",
  },
  pinLength: asNumber(process.env.NEXT_PUBLIC_PIN_LENGTH, 6),
  pinMaxAttempts: asNumber(process.env.NEXT_PUBLIC_PIN_MAX_ATTEMPTS, 5),
  argon2MemoryKib: asNumber(process.env.NEXT_PUBLIC_ARGON2_MEMORY_KIB, 65536),
  argon2Passes: asNumber(process.env.NEXT_PUBLIC_ARGON2_PASSES, 3),
  autolockSec: asNumber(process.env.NEXT_PUBLIC_AUTOLOCK_SEC, 300),
  passkeyRpId: process.env.NEXT_PUBLIC_PASSKEY_RP_ID || "localhost",
  recoveryWords: asNumber(process.env.NEXT_PUBLIC_RECOVERY_WORDS, 24) >= 24 ? 24 : 12,
  clipboardClearSec: asNumber(process.env.NEXT_PUBLIC_CLIPBOARD_CLEAR_SEC, 30),
  maxUploadMb: asNumber(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB, 20),
  chatAutodeleteDefault: asFlag(process.env.NEXT_PUBLIC_CHAT_AUTODELETE_DEFAULT, false),
  chatSyncDefault: asFlag(process.env.NEXT_PUBLIC_CHAT_SYNC_DEFAULT, false),
  landingAnimation: asFlag(process.env.NEXT_PUBLIC_LANDING_ANIMATION, true),
  sourceUrl: process.env.NEXT_PUBLIC_SOURCE_URL || "",
  docsUrl: process.env.NEXT_PUBLIC_DOCS_URL || "",
  commitSha: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || "dev",
} as const;

export function apiBase(networkName: Network): string {
  return config.apiBase[networkName].replace(/\/$/, "");
}

export function lightwalletdUrl(networkName: Network): string {
  return config.lightwalletd[networkName];
}
