"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { config, type Network } from "@/lib/config";
import { formatCredits, formatZec } from "@/lib/zeep";
import type { PriceSheet } from "@/lib/zeep/prices";
import { emit, readSession, subscribe } from "@/lib/vault/session";
import { lockVault, readPrefs, switchNetwork, vaultStatus } from "@/lib/vault/vault";
import { useToast } from "@/components/Toast";

export type VaultView = {
  ready: boolean;
  network: Network;
  status: "empty" | "locked" | "unlocked" | "wiped";
  hasPasskey: boolean;
  inboxId: string | null;
  inboxAddress: string | null;
  balanceZats: string;
  creditLabel: string;
  zecLabel: string;
  zatsPerCredit: number;
  prices: PriceSheet | null;
  walletZats: string | null;
  receiveAddress: string;
};

const VaultContext = createContext<{
  view: VaultView;
  lock: () => Promise<void>;
  chooseNetwork: (network: Network) => Promise<void>;
  refresh: () => Promise<void>;
} | null>(null);

function blank(network: Network): VaultView {
  return {
    ready: false,
    network,
    status: "locked",
    hasPasskey: false,
    inboxId: null,
    inboxAddress: null,
    balanceZats: "0",
    creditLabel: "…",
    zecLabel: "0",
    zatsPerCredit: 10_000,
    prices: null,
    walletZats: null,
    receiveAddress: "",
  };
}

function fromSession(network: Network): VaultView {
  const session = readSession();
  if (!session || session.network !== network) return { ...blank(network), ready: true, status: "locked" };
  const per = session.prices?.zats_per_credit ?? 10_000;
  return {
    ready: true,
    network,
    status: "unlocked",
    hasPasskey: session.hasPasskey,
    inboxId: session.record.inboxId,
    inboxAddress: session.record.inboxAddress,
    balanceZats: session.balanceZats.toString(),
    creditLabel: session.prices ? formatCredits(session.balanceZats, per) : "…",
    zecLabel: formatZec(session.balanceZats),
    zatsPerCredit: per,
    prices: session.prices,
    walletZats: session.walletZats === null ? null : session.walletZats.toString(),
    receiveAddress: session.receiveAddress,
  };
}

export function VaultState({ children }: { children: ReactNode }) {
  const router = useRouter();
  const toast = useToast();
  const [view, setView] = useState<VaultView>(() => blank(config.defaultNetwork));

  const refresh = useCallback(async () => {
    const prefs = await readPrefs();
    const session = readSession();
    if (session?.network === prefs.network) {
      setView(fromSession(prefs.network));
      return;
    }
    const status = await vaultStatus(prefs.network);
    setView({ ...blank(prefs.network), ready: true, status });
  }, []);

  useEffect(() => {
    void refresh();
    return subscribe(() => {
      void refresh();
    });
  }, [refresh]);

  useEffect(() => {
    if (view.status !== "unlocked") return;
    const session = readSession();
    if (!session) return;
    let timer = 0;
    const pull = () => {
      void session.client.prices().then((prices) => {
        const current = readSession();
        if (!current) return;
        current.prices = prices;
        emit();
        window.clearInterval(timer);
        timer = window.setInterval(pull, Math.max(30, prices.refresh_sec ?? 300) * 1000);
      }).catch(() => {});
    };
    pull();
    return () => window.clearInterval(timer);
  }, [view.status, view.network]);

  const lock = useCallback(async () => {
    await lockVault();
    router.push("/unlock");
  }, [router]);

  const chooseNetwork = useCallback(
    async (network: Network) => {
      if (network === view.network && view.ready) return;
      await switchNetwork(network);
      const status = await vaultStatus(network);
      if (status === "locked") router.push("/unlock");
      else if (status === "wiped") router.push("/restore");
      else router.push("/get");
    },
    [router, view.network, view.ready],
  );

  useEffect(() => {
    if (view.status !== "unlocked") return;
    let timer = window.setTimeout(() => {
      void lock().then(() => toast("Locked after inactivity.", "warn"));
    }, config.autolockSec * 1000);
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void lock().then(() => toast("Locked after inactivity.", "warn"));
      }, config.autolockSec * 1000);
    };
    let hiddenAt = 0;
    const onShow = () => {
      if (document.hidden) hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > 60_000) {
        void lock().then(() => toast("Locked because this tab was hidden.", "warn"));
      }
    };
    window.addEventListener("pointerdown", reset);
    window.addEventListener("keydown", reset);
    document.addEventListener("visibilitychange", onShow);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointerdown", reset);
      window.removeEventListener("keydown", reset);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, [view.status, lock, toast]);

  const value = useMemo(() => ({ view, lock, chooseNetwork, refresh }), [view, lock, chooseNetwork, refresh]);
  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
}

export function useVault() {
  const value = useContext(VaultContext);
  if (!value) throw new Error("useVault must be used inside Providers");
  return value;
}
