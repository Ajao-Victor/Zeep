"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DepositPanel } from "@/components/deposit/DepositPanel";
import { WithdrawForm } from "@/components/screens/CreditsScreen";
import { RecentActivity } from "@/components/wallet/RecentActivity";
import { Button } from "@/components/Button";
import { Page, Panel } from "@/components/Panel";
import { useToast } from "@/components/Toast";
import { IconButton } from "@/components/ui/IconButton";
import { useVault } from "@/components/Providers";
import { emit, readSession } from "@/lib/vault/session";

export function WalletScreen() {
  const { view } = useVault();
  const toast = useToast();
  const params = useSearchParams();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const raw = params.get("action");
  const action = raw === "deposit" || raw === "withdraw" ? raw : null;

  async function refreshBalance() {
    const session = readSession();
    if (!session || refreshing) return;
    setRefreshing(true);
    try {
      session.client.book.lastWatchCheck = 0;
      await session.client.pollDeposits();
      await session.client.refreshSpent();
      const prices = await session.client.prices();
      const current = readSession();
      if (current) {
        current.prices = prices;
        emit();
      }
    } catch {
      toast("Couldn't refresh the balance.", "warn");
    } finally {
      setRefreshing(false);
    }
  }

  function open(next: "deposit" | "withdraw") {
    router.replace(action === next ? "/wallet" : `/wallet?action=${next}`);
  }

  return (
    <Page narrow>
      <header className="pb-6 pt-4">
        <h1 className="text-[32px] font-semibold tracking-[-0.025em]">Wallet</h1>
      </header>
      <Panel>
        <div className="flex items-center gap-1">
          <p className="font-mono text-[32px] leading-none text-gold">{view.creditLabel} cr</p>
          <IconButton label="Refresh balance" disabled={refreshing} aria-busy={refreshing || undefined} onClick={() => void refreshBalance()}>
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className={refreshing ? "animate-spin" : undefined}>
              <path d="M13.2 8A5.2 5.2 0 1 1 11.6 4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              <path d="M11.2 1.8v3.1H8.1" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </IconButton>
        </div>
        <p className="mt-2 font-mono text-[18px] text-text">{view.totalUsdLabel}</p>
        <div className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-4">
          <div>
            <p className="text-[12px] text-faint">Credits</p>
            <p className="mt-1 text-[15px] text-text">{view.usdCreditLabel} cr</p>
            <p className="text-[13px] text-muted">{view.usdLabel}</p>
          </div>
          <div>
            <p className="text-[12px] text-faint">ZEC</p>
            <p className="mt-1 text-[15px] text-text">{view.zecHeldLabel} ZEC</p>
            <p className="text-[13px] text-muted">{view.zecValueLabel}</p>
          </div>
        </div>
      </Panel>
      <RecentActivity />
      <div className="mt-4 flex gap-2">
        <Button variant={action === "deposit" ? "primary" : "secondary"} onClick={() => open("deposit")}>Deposit</Button>
        <Button variant={action === "withdraw" ? "primary" : "secondary"} onClick={() => open("withdraw")}>Withdraw</Button>
      </div>
      {action === "deposit" ? (
        <Panel className="mt-4">
          <DepositPanel />
        </Panel>
      ) : null}
      {action === "withdraw" ? (
        <Panel className="mt-4">
          <WithdrawForm />
        </Panel>
      ) : null}
    </Page>
  );
}
