"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { formatUsd } from "@/lib/zeep";
import { Notice, Page, PageIntro, Panel } from "@/components/Panel";
import { useVault } from "@/components/Providers";

export function ReserveScreen() {
  const { view } = useVault();
  const books = useQuery({
    queryKey: ["reserve", view.network],
    queryFn: () => api(view.network).reserve(),
    retry: false,
    enabled: view.ready,
  });
  const data = books.data;
  const rows = [
    ["Owed", data ? formatUsd(data.owed_micro_usd) : "—"],
    ["Held", data ? formatUsd(data.held_micro_usd) : "—"],
    ["Coverage", data ? `${data.coverage_pct}%` : "—"],
    ["Deposits", data ? formatUsd(data.totals.usd_deposits_micro_usd) : "—"],
    ["Services", data ? formatUsd(data.totals.services_micro_usd) : "—"],
  ] as const;

  return (
    <Page>
      <PageIntro kicker="Public books" title="Reserve" lede="What is owed, what is held, and coverage. These numbers are public. They are not tied to a person." />
      {books.isError ? <Notice>The public books are unreachable from this browser.</Notice> : null}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {rows.map(([label, value]) => (
          <Panel key={label} padding="card">
            <b className="block font-mono text-[20px] font-medium">{value}</b>
            <p className="mt-1 text-[13px] text-muted">{label}</p>
          </Panel>
        ))}
      </div>
    </Page>
  );
}
