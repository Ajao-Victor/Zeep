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
      <PageIntro kicker="Services" title="Pay per request." lede="Each request is one proof. The price is the live sheet, shown in credits." />
      <div className="mb-4">
        <Panel>
          <p className="font-mono text-[22px] text-gold">{view.creditLabel} cr</p>
          <p className="mt-1 text-[14px] text-muted">{view.totalUsdLabel}</p>
          <div className="mt-4">
            <Button href="/wallet?action=deposit">Deposit</Button>
          </div>
        </Panel>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {SERVICES.map((service) => {
          const researchFrom = service.id === "search" ? view.prices?.routes.research_base?.micro_usd : undefined;
          const micro = service.route
            ? view.prices?.routes[service.route]?.micro_usd
            : view.prices?.models.find((model) => model.id === view.prices?.default_model)?.micro_usd;
          const price = researchFrom !== undefined
            ? `research from ${formatCredits(researchFrom, view.microPerCredit)} cr`
            : micro === undefined
              ? "…"
              : service.route
                ? `${formatCredits(micro, view.microPerCredit)} cr`
                : `from ${formatCredits(micro, view.microPerCredit)} cr`;
          return <ServiceCard key={service.id} name={service.name} summary={service.summary} href={service.href} cost={price} />;
        })}
        {SERVICES.length % 2 === 1 ? (
          <div className="flex flex-col rounded-xl border border-dashed border-line-strong p-5">
            <b className="text-[15px] font-medium text-muted">Next</b>
            <p className="mt-1.5 text-[13px] leading-normal text-faint">Same proof, same balance.</p>
          </div>
        ) : null}
      </div>
    </Page>
  );
}
