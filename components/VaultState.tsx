"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { config, type Network } from "@/lib/config";
import { formatCredits, formatUsd, formatZec, zatsToMicroUsd } from "@/lib/zeep";
import type { PriceSheet } from "@/lib/zeep/prices";
import { setDoorIntent, type DoorIntent } from "@/lib/fx/doorIntent";
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
  creditLabel: string;
  usdLabel: string;
  zecHeldLabel: string;
  zecValueLabel: string;
  microPerCredit: number;
  prices: PriceSheet | null;
};

const VaultContext = createContext<{
  view: VaultView;
  lock: (reason?: Exclude<DoorIntent["reason"], "switch">) => Promise<void>;
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
    creditLabel: "…",
    usdLabel: "$0.00",
    zecHeldLabel: "0",
    zecValueLabel: "…",
    microPerCredit: 1_000_000,
    prices: null,
  };
}

function fromSession(network: Network): VaultView {
  const session = readSession();
  if (!session || session.network !== network) return { ...blank(network), ready: true, status: "locked" };
  const prices = session.prices;
  const per = prices?.micro_usd_per_credit ?? 1_000_000;
  const zecUsd = prices?.zec_usd ?? 0;
  return {
    ready: true,
    network,
    status: "unlocked",
    hasPasskey: session.hasPasskey,
    inboxId: session.record.inboxId,
    inboxAddress: session.record.inboxAddress,
    creditLabel: prices ? formatCredits(session.client.totalMicroUsd(zecUsd), per) : "…",
    usdLabel: formatUsd(session.usdMicro),
    zecHeldLabel: formatZec(session.zecZats),
    zecValueLabel: prices ? formatUsd(zatsToMicroUsd(session.zecZats, zecUsd)) : "…",
    microPerCredit: per,
    prices,
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

  // The session is cleared first; only then does /unlock play the Vault Door closing.
  const lock = useCallback(
    async (reason: Exclude<DoorIntent["reason"], "switch"> = "lock") => {
      await lockVault();
      setDoorIntent({ reason });
      router.push("/unlock");
    },
    [router],
  );

  const chooseNetwork = useCallback(
    async (network: Network) => {
      if (network === view.network && view.ready) return;
      await switchNetwork(network);
      const status = await vaultStatus(network);
      // Only /unlock plays the door, so only record the switch when that is where we are going.
      if (status === "locked") {
        setDoorIntent({ reason: "switch", network });
        router.push("/unlock");
      }
      else if (status === "wiped") router.push("/restore");
      else router.push("/get");
    },
    [router, view.network, view.ready],
  );

  useEffect(() => {
    if (view.status !== "unlocked") return;
    let timer = window.setTimeout(() => {
      void lock("idle").then(() => toast("Locked after inactivity.", "warn"));
    }, config.autolockSec * 1000);
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void lock("idle").then(() => toast("Locked after inactivity.", "warn"));
      }, config.autolockSec * 1000);
    };
    let hiddenAt = 0;
    const onShow = () => {
      if (document.hidden) hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > 60_000) {
        void lock("hidden").then(() => toast("Locked because this tab was hidden.", "warn"));
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
