"use client";

import { DepositPanel } from "@/components/deposit/DepositPanel";
import { Page, PageIntro, Panel } from "@/components/Panel";

export default function DepositPage() {
  return (
    <Page narrow>
      <PageIntro kicker="Deposit" title="Add ZEC to the private balance." lede="Type any amount. The address is fresh, and no memo is required." />
      <Panel>
        <DepositPanel />
      </Panel>
    </Page>
  );
}
