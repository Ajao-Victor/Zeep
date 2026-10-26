import type { Network } from "@/lib/config";
import type { ZeepClient, ZeepKeys } from "@/lib/zeep";
import type { PriceSheet } from "@/lib/zeep/prices";

export type CipherBlob = { iv: string; ct: string };

export type VaultMeta = {
  salt?: string;
  failedAttempts: number;
  credentialId?: string;
  pinWrap?: CipherBlob;
  prfWrap?: CipherBlob;
  wipedAt?: number;
};

export type VaultRecord = {
  v: 2;
  phrase: string;
  inboxId: string | null;
  inboxAddress: string | null;
  createdAt: number;
};

export type Prefs = {
  network: Network;
};

export type NoteFile = {
  notes: import("@/lib/zeep").Note[];
  nextDeposit: number;
  refill?: { base: string; stage: number };
  pendingDeposits?: number[];
  lastWithdrawalDay?: number;
  watchedDeposits?: Record<number, number>;
};

export type WalletHold = {
  shieldedZats: bigint;
  transparentZats: bigint;
  unified: string;
  transparentAddress: string;
  shielding: boolean;
};

export type Session = {
  network: Network;
  key: CryptoKey;
  phrase: string;
  seed: Uint8Array;
  keys: ZeepKeys;
  client: ZeepClient;
  record: VaultRecord;
  hasPasskey: boolean;
  usdMicro: bigint;
  zecZats: bigint;
  prices: PriceSheet | null;
  wallet: WalletHold | null;
};

export type { PriceSheet };
