"use client";

import { SERVICES } from "@/lib/catalog";
import { formatCredits } from "@/lib/zeep";
import { Button } from "@/components/Button";
import { Page, PageIntro, Panel } from "@/components/Panel";
import { ServiceCard } from "@/components/ServiceCard";
import { useVault } from "@/components/Providers";

export function ServicesScreen() {
  const { view } = useVault();
  return (
    <Page>
      <PageIntro kicker="Services" title="Pay per request, in ZEC." lede="Each button takes one proof. The price is the live sheet, shown in credits." />
      <div className="mb-4">
        <Panel>
          <p className="font-mono text-[22px] text-gold">{view.creditLabel} cr</p>
          <p className="mt-1 text-[13px] text-muted">{view.zecLabel} ZEC in the private balance</p>
          {view.walletZats !== null ? (
            <p className="mt-1 text-[13px] text-faint">In-app wallet: {view.walletZats} zats</p>
          ) : null}
          <div className="mt-4">
            <Button href="/deposit">Deposit</Button>
          </div>
        </Panel>
      </div>
      <div className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2">
        {SERVICES.map((service) => {
          const zats = service.route
            ? view.prices?.routes[service.route]?.zats
            : view.prices?.models.find((model) => model.id === view.prices?.default_model)?.zats;
          const price = zats === undefined ? "…" : service.route ? `${formatCredits(zats, view.zatsPerCredit)} cr` : `from ${formatCredits(zats, view.zatsPerCredit)} cr`;
          return <ServiceCard key={service.id} name={service.name} summary={service.summary} href={service.href} cost={price} />;
        })}
        {SERVICES.length % 2 === 1 ? (
          <div className="flex h-full flex-col bg-bg p-5">
            <b className="text-[15px] font-medium text-muted">Next</b>
            <p className="mt-1.5 text-[13px] leading-normal text-faint">Same proof, same balance.</p>
          </div>
        ) : null}
      </div>
    </Page>
  );
}
