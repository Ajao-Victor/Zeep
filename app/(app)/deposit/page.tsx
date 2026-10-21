"use client";

import { DepositPanel } from "@/components/deposit/DepositPanel";
import { Page, PageIntro, Panel } from "@/components/Panel";
import { WalletCard } from "@/components/wallet/WalletCard";

export default function DepositPage() {
  return (
    <Page narrow>
      <PageIntro kicker="Deposit" title="Add ZEC." lede="Any amount. Half stays ZEC, half becomes dollars. The address is fresh, and no memo is required." />
      <div className="mb-4">
        <Panel>
          <WalletCard />
        </Panel>
      </div>
      <Panel>
        <DepositPanel />
      </Panel>
    </Page>
  );
}
