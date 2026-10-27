"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { config, type Network } from "@/lib/config";
import { setAccountHint } from "@/lib/account/hint";
import { formatCredits, formatUsd, formatZec, zatsToMicroUsd } from "@/lib/zeep";
import type { PriceSheet } from "@/lib/zeep/prices";
import { setDoorIntent, type DoorIntent } from "@/lib/fx/doorIntent";
import { emit, readSession, subscribe } from "@/lib/vault/session";
import { lockVault, readPrefs, vaultStatus } from "@/lib/vault/vault";
import { useToast } from "@/components/Toast";

export type VaultView = {
  ready: boolean;
  network: Network;
  status: "empty" | "locked" | "unlocked" | "wiped";
  hasPasskey: boolean;
  inboxId: string | null;
  inboxAddress: string | null;
  creditLabel: string;
  totalUsdLabel: string;
  usdCreditLabel: string;
  usdLabel: string;
  zecHeldLabel: string;
  zecValueLabel: string;
  microPerCredit: number;
  prices: PriceSheet | null;
};

const VaultContext = createContext<{
  view: VaultView;
  lock: (reason?: Exclude<DoorIntent["reason"], "switch">) => Promise<void>;
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
    totalUsdLabel: "…",
    usdCreditLabel: "0",
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
    totalUsdLabel: prices ? formatUsd(session.client.totalMicroUsd(zecUsd)) : "…",
    usdCreditLabel: formatCredits(session.usdMicro, per),
    usdLabel: formatUsd(session.usdMicro),
    zecHeldLabel: formatZec(session.zecZats),
    zecValueLabel: prices ? formatUsd(zatsToMicroUsd(session.zecZats, zecUsd)) : "…",
    microPerCredit: per,
    prices,
  };
}

/**
 * Where a lock goes: /unlock with `next` set to the current page. It is the
 * same URL RequireVault redirects app routes to, so the page sees one navigation and /unlock
 * mounts once (a second navigation would remount it and drop the Vault Door's reason line).
 */
function unlockUrl(): string {
  const here = window.location.pathname;
  if (here === "/unlock" || here === "/get" || here === "/restore") return "/unlock";
  return `/unlock?next=${encodeURIComponent(here)}`;
}

export function VaultState({ children }: { children: ReactNode }) {
  const router = useRouter();
  const toast = useToast();
  const [view, setView] = useState<VaultView>(() => blank(config.network));

  const refresh = useCallback(async () => {
    const prefs = await readPrefs();
    const session = readSession();
    if (session?.network === prefs.network) {
      if (prefs.network === config.network) setAccountHint(true);
      setView(fromSession(prefs.network));
      return;
    }
    const status = await vaultStatus(prefs.network);
    // The hint covers this build's network only (one frontend per network).
    if (prefs.network === config.network) setAccountHint(status === "locked");
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
        const sec = Math.min(60, Math.max(30, prices.refresh_sec ?? 60));
        timer = window.setInterval(pull, sec * 1000);
      }).catch(() => {});
    };
    pull();
    return () => window.clearInterval(timer);
  }, [view.status, view.network]);

  useEffect(() => {
    if (view.status !== "unlocked") return;
    const session = readSession();
    if (!session) return;
    const tick = () => {
      const current = readSession();
      if (!current) return;
      void current.client.pollDeposits().catch(() => {});
    };
    tick();
    const timer = window.setInterval(tick, 15_000);
    return () => window.clearInterval(timer);
  }, [view.status, view.network]);

  // The session is cleared first; only then does /unlock play the Vault Door closing.
  // While unlocked, keep /unlock's code warm, so a lock or auto-lock shows the door without a fetch.
  useEffect(() => {
    if (view.status === "unlocked") router.prefetch("/unlock");
  }, [view.status, router]);

  const lock = useCallback(
    async (reason: Exclude<DoorIntent["reason"], "switch"> = "lock") => {
      await lockVault();
      setDoorIntent({ reason });
      router.push(unlockUrl());
    },
    [router],
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
      else if (hiddenAt && Date.now() - hiddenAt > config.autolockSec * 1000) {
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

  const value = useMemo(() => ({ view, lock, refresh }), [view, lock, refresh]);
  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
}

export function useVault() {
  const value = useContext(VaultContext);
  if (!value) throw new Error("useVault must be used inside Providers");
  return value;
}
