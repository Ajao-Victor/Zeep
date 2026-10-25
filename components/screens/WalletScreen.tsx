"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { DepositPanel } from "@/components/deposit/DepositPanel";
import { WithdrawForm } from "@/components/screens/CreditsScreen";
import { WalletCard } from "@/components/wallet/WalletCard";
import { Button } from "@/components/Button";
import { Page, Panel } from "@/components/Panel";
import { useVault } from "@/components/Providers";

export function WalletScreen() {
  const { view } = useVault();
  const params = useSearchParams();
  const router = useRouter();
  const raw = params.get("action");
  const action = raw === "deposit" || raw === "withdraw" ? raw : null;

  function open(next: "deposit" | "withdraw") {
    router.replace(action === next ? "/wallet" : `/wallet?action=${next}`);
  }

  return (
    <Page narrow>
      <header className="pb-6 pt-4">
        <h1 className="text-[32px] font-semibold tracking-[-0.025em]">Wallet</h1>
      </header>
      <Panel>
        <p className="font-mono text-[32px] leading-none text-gold">{view.creditLabel} cr</p>
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
      <div className="mt-4 flex gap-2">
        <Button variant={action === "deposit" ? "primary" : "secondary"} onClick={() => open("deposit")}>Deposit</Button>
        <Button variant={action === "withdraw" ? "primary" : "secondary"} onClick={() => open("withdraw")}>Withdraw</Button>
      </div>
      {action === "deposit" ? (
        <div className="mt-4 grid gap-4">
          <Panel>
            <WalletCard />
          </Panel>
          <Panel>
            <DepositPanel />
          </Panel>
        </div>
      ) : null}
      {action === "withdraw" ? (
        <Panel className="mt-4">
          <WithdrawForm />
        </Panel>
      ) : null}
    </Page>
  );
}
