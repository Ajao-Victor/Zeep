import { config, apiBase, type Network } from "@/lib/config";
import { fromHex, hex, randomBytes, zero } from "@/lib/bytes";
import { deriveKeys, NoteBook, seedFromPhrase, USD, ZEC, ZeepClient } from "@/lib/zeep";
import { workerProve, stopProver } from "@/lib/zeep/prove";
import { kvDel, kvGet, kvKeys, kvSet, migrateStore, storeKey } from "@/lib/vault/db";
import { closeWallet } from "@/lib/zcash/wallet";
import { decryptBytes, decryptJson, encryptBytes, encryptJson, importAes } from "@/lib/vault/crypto";
import { derivePinKey } from "@/lib/vault/kdf";
import { phraseValid } from "@/lib/vault/phrase";
import { clearSession, emit, readSession, setSession } from "@/lib/vault/session";
import type { CipherBlob, NoteFile, Prefs, Session, VaultMeta, VaultRecord } from "@/lib/vault/types";

export class PinError extends Error {
  readonly wiped: boolean;
  readonly attemptsLeft: number;

  constructor(message: string, wiped: boolean, attemptsLeft: number) {
    super(message);
    this.wiped = wiped;
    this.attemptsLeft = attemptsLeft;
  }
}

export async function readPrefs(): Promise<Prefs> {
  return { network: config.network };
}

export async function vaultStatus(network: Network): Promise<"empty" | "locked" | "wiped"> {
  if (network !== config.network) return "empty";
  await migrateStore(network);
  const vault = await kvGet(storeKey.vault(network));
  if (vault) return "locked";
  const meta = await kvGet<VaultMeta>(storeKey.meta(network));
  if (meta?.wipedAt) return "wiped";
  return "empty";
}

function assertPin(pin: string) {
  if (!new RegExp(`^\\d{${config.pinLength}}$`).test(pin)) {
    throw new Error(`Enter a ${config.pinLength}-digit PIN.`);
  }
}

async function wipe(network: Network) {
  await Promise.all([kvDel(storeKey.vault(network)), kvDel(storeKey.notes(network))]);
  await kvSet(storeKey.meta(network), { failedAttempts: 0, wipedAt: Date.now() } satisfies VaultMeta);
  if (readSession()?.network === network) {
    stopProver();
    clearSession();
  }
}

async function noteFailure(network: Network, meta: VaultMeta): Promise<PinError> {
  const attempts = meta.failedAttempts + 1;
  if (attempts >= config.pinMaxAttempts) {
    await wipe(network);
    return new PinError("Five wrong PINs erased the vault on this device.", true, 0);
  }
  await kvSet(storeKey.meta(network), { ...meta, failedAttempts: attempts });
  const left = config.pinMaxAttempts - attempts;
  return new PinError(`Wrong PIN. ${left} ${left === 1 ? "try" : "tries"} left.`, false, left);
}

async function openSession(network: Network, key: CryptoKey, meta: VaultMeta, record: VaultRecord, notes: NoteFile | null) {
  if (network !== config.network) throw new Error("This build is for a different network.");
  if (record.v !== 2 || !record.phrase) {
    throw new Error("This pass uses the old credit model. Restore the 24 words to open the new balance.");
  }
  const seed = seedFromPhrase(record.phrase);
  const keys = deriveKeys(seed, config.network);
  const book = NoteBook.from(notes);
  const client = new ZeepClient({
    baseUrl: apiBase(network),
    keys,
    book,
    prove: workerProve,
    onChange: async (next) => {
      const current = readSession();
      if (!current || current.network !== network) return;
      await kvSet(storeKey.notes(network), await encryptJson(key, next.toJSON()));
      const balances = { usd: next.balance(USD), zec: next.balance(ZEC) };
      current.usdMicro = balances.usd;
      current.zecZats = balances.zec;
      emit();
    },
  });
  setSession({
    network,
    key,
    phrase: record.phrase,
    seed,
    keys,
    client,
    record,
    hasPasskey: Boolean(meta.credentialId && meta.prfWrap),
    usdMicro: book.balance(USD),
    zecZats: book.balance(ZEC),
    prices: null,
    wallet: null,
  });
  await kvSet(storeKey.meta(network), { ...meta, failedAttempts: 0, wipedAt: undefined });
  void navigator.storage?.persist?.().catch(() => undefined);
  void client.refreshSpent().catch(() => {});
  void client.prices().then((prices) => {
    const current = readSession();
    if (current?.network === network) {
      current.prices = prices;
      emit();
    }
  }).catch(() => {});
}

async function readEncrypted(network: Network, key: CryptoKey) {
  const vaultBlob = await kvGet<CipherBlob>(storeKey.vault(network));
  if (!vaultBlob) throw new Error("This network has no pass on this device.");
  const record = await decryptJson<VaultRecord>(key, vaultBlob);
  const noteBlob = await kvGet<CipherBlob>(storeKey.notes(network));
  const notes = noteBlob ? await decryptJson<NoteFile>(key, noteBlob) : null;
  return { record, notes };
}

export async function unlockWithPin(network: Network, pin: string) {
  assertPin(pin);
  const meta = await kvGet<VaultMeta>(storeKey.meta(network));
  if (!meta?.salt || !meta.pinWrap) {
    if (meta?.wipedAt) throw new PinError("This device's vault was erased. Restore the 24 words.", true, 0);
    throw new Error("This network has no pass on this device.");
  }
  const pinKey = await derivePinKey(pin, fromHex(meta.salt));
  let raw: Uint8Array | null = null;
  try {
    raw = await decryptBytes(pinKey, meta.pinWrap);
  } catch {
    throw await noteFailure(network, meta);
  }
  try {
    const key = await importAes(raw);
    const opened = await readEncrypted(network, key);
    await openSession(network, key, meta, opened.record, opened.notes);
  } finally {
    zero(raw);
  }
}

export async function unlockWithPasskey(network: Network, prf: Uint8Array) {
  const meta = await kvGet<VaultMeta>(storeKey.meta(network));
  if (!meta?.prfWrap) throw new Error("Fingerprint unlock is not set on this pass.");
  try {
    const wrapper = await importAes(prf);
    let raw: Uint8Array | null = null;
    try {
      raw = await decryptBytes(wrapper, meta.prfWrap);
    } catch {
      throw new Error("Fingerprint unlock did not match this pass.");
    }
    try {
      const key = await importAes(raw);
      const opened = await readEncrypted(network, key);
      await openSession(network, key, meta, opened.record, opened.notes);
    } finally {
      zero(raw);
    }
  } finally {
    zero(prf);
  }
}

export async function readMeta(network: Network): Promise<VaultMeta | undefined> {
  return kvGet<VaultMeta>(storeKey.meta(network));
}

export async function verifyPrf(prf: Uint8Array) {
  const session = readSession();
  if (!session) throw new Error("Unlock this device first.");
  const meta = await kvGet<VaultMeta>(storeKey.meta(session.network));
  if (!meta?.prfWrap) throw new Error("Fingerprint unlock is not set on this pass.");
  try {
    const wrapper = await importAes(prf);
    await decryptBytes(wrapper, meta.prfWrap);
  } catch {
    throw new Error("Fingerprint did not match this pass.");
  } finally {
    zero(prf);
  }
}

export async function verifyPin(pin: string) {
  const session = readSession();
  if (!session) throw new Error("Unlock this device first.");
  const meta = await kvGet<VaultMeta>(storeKey.meta(session.network));
  if (!meta?.salt || !meta.pinWrap) throw new Error("This pass has no PIN.");
  assertPin(pin);
  const pinKey = await derivePinKey(pin, fromHex(meta.salt));
  try {
    await decryptBytes(pinKey, meta.pinWrap);
  } catch {
    throw await noteFailure(session.network, meta);
  }
  await kvSet(storeKey.meta(session.network), { ...meta, failedAttempts: 0 });
}

async function persist(network: Network, key: CryptoKey, record: VaultRecord, notes: NoteFile, meta: VaultMeta) {
  await Promise.all([
    kvSet(storeKey.vault(network), await encryptJson(key, record)),
    kvSet(storeKey.notes(network), await encryptJson(key, notes)),
    kvSet(storeKey.meta(network), meta),
  ]);
}

async function mint(input: { network: Network; pin: string; phrase: string; prf?: Uint8Array; credentialId?: string }) {
  assertPin(input.pin);
  if (!phraseValid(input.phrase)) throw new Error("The recovery phrase is not valid.");
  const salt = randomBytes(16);
  const rawKey = randomBytes(32);
  try {
    const key = await importAes(rawKey);
    const pinKey = await derivePinKey(input.pin, salt);
    const pinWrap = await encryptBytes(pinKey, rawKey);
    let prfWrap: CipherBlob | undefined;
    if (input.prf && input.credentialId) {
      prfWrap = await encryptBytes(await importAes(input.prf), rawKey);
    }
    const record: VaultRecord = {
      v: 2,
      phrase: input.phrase.trim().toLowerCase().split(/\s+/).join(" "),
      inboxId: null,
      inboxAddress: null,
      createdAt: Date.now(),
    };
    const notes: NoteFile = { notes: [], nextDeposit: 0 };
    const meta: VaultMeta = { salt: hex(salt), failedAttempts: 0, credentialId: input.credentialId, pinWrap, prfWrap };
    await persist(input.network, key, record, notes, meta);
    await openSession(input.network, key, meta, record, notes);
  } finally {
    zero(rawKey);
    zero(input.prf);
  }
}

export async function createVault(input: { network: Network; pin: string; phrase: string; prf?: Uint8Array; credentialId?: string }) {
  if (input.network !== config.network) throw new Error("This build is for a different network.");
  await migrateStore(input.network);
  const existing = await kvGet(storeKey.vault(input.network));
  if (existing) throw new Error("This network already has a pass on this device.");
  await mint(input);
  const session = readSession();
  if (!session) return;
  void import("@/lib/zcash/wallet")
    .then(({ walletSummary }) => walletSummary(session.phrase, session.network, 0))
    .then(async (summary) => {
      if (summary.height <= 0 || readSession()?.network !== session.network) return;
      const { rememberBirthday } = await import("@/lib/zcash/birthday");
      await rememberBirthday(session.network, session.keys, summary.height);
    })
    .catch(() => undefined);
}

export async function restoreVault(
  input: { network: Network; pin: string; phrase: string; prf?: Uint8Array; credentialId?: string },
  onProgress?: (msg: string) => void,
) {
  await mint(input);
  const session = readSession();
  if (!session) throw new Error("The vault did not open.");
  onProgress?.("Finding your notes");
  await session.client.restore(onProgress);
  const balances = session.client.balances();
  session.usdMicro = balances.usd;
  session.zecZats = balances.zec;
  emit();
  const { readWalletBirthday, saplingBirthday } = await import("@/lib/zcash/birthday");
  const saved = await readWalletBirthday(session.network, session.keys);
  const birthday = saved ?? saplingBirthday(session.network);
  if (saved == null) onProgress?.("Restoring your wallet can take a few minutes");
  else onProgress?.("Restoring the wallet");
  try {
    const { walletSummary } = await import("@/lib/zcash/wallet");
    const summary = await walletSummary(session.phrase, session.network, birthday);
    const { rememberBirthday } = await import("@/lib/zcash/birthday");
    if (summary.height > 0) await rememberBirthday(session.network, session.keys, summary.height);
  } catch {
    onProgress?.("The in-app wallet will finish when its lightwalletd URL is set");
  }
  const { readChatPrefs } = await import("@/lib/chat/store");
  const { pullChats } = await import("@/lib/chat/sync");
  const prefs = await readChatPrefs(session.network);
  if (prefs.sync) {
    onProgress?.("Restoring chats");
    await pullChats(session.network, session.keys, prefs.autodelete).catch(() => undefined);
  }
  return balances;
}

export async function signOut(network: Network) {
  stopProver();
  closeWallet();
  const keys = await kvKeys();
  const belongs = (key: string) => {
    if (key.startsWith(`zeep:${network}:`)) return true;
    if (key.startsWith("zeep:")) return false;
    return key.endsWith(`:${network}`) || key.includes(`:${network}:`);
  };
  await Promise.all(keys.filter(belongs).map((key) => kvDel(key)));
  await kvDel(storeKey.vault(network));
  await kvDel(storeKey.meta(network));
  await kvDel(storeKey.notes(network));
  if (typeof indexedDB.databases === "function") {
    const databases = await indexedDB.databases();
    await Promise.all(
      databases
        .filter((item) => item.name && item.name !== "zeep" && /webzjs|zcash|wallet/i.test(item.name))
        .map(
          (item) =>
            new Promise<void>((resolve) => {
              const request = indexedDB.deleteDatabase(item.name as string);
              request.onsuccess = () => resolve();
              request.onerror = () => resolve();
              request.onblocked = () => resolve();
            }),
        ),
    );
  }
  if (readSession()?.network === network) clearSession();
  else emit();
}

export async function lockVault() {
  stopProver();
  closeWallet();
  clearSession();
}

export async function saveRecord() {
  const session = readSession();
  if (!session) throw new Error("Unlock this device first.");
  await kvSet(storeKey.vault(session.network), await encryptJson(session.key, session.record));
  emit();
}

export async function setInbox(id: string, address: string) {
  const session = readSession();
  if (!session) throw new Error("Unlock this device first.");
  session.record.inboxId = id;
  session.record.inboxAddress = address;
  await saveRecord();
}

export async function clearInbox() {
  const session = readSession();
  if (!session) return;
  session.record.inboxId = null;
  session.record.inboxAddress = null;
  await saveRecord();
}

export function requireSession(): Session {
  const session = readSession();
  if (!session) throw new Error("Unlock this device first.");
  return session;
}
