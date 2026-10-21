"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { Notice, Page, PageIntro, Panel } from "@/components/Panel";
import { useVault } from "@/components/Providers";

const ROWS = [
  ["issued", "Credits sold"],
  ["used", "Credits spent"],
  ["refunded", "Credits refunded"],
  ["owed", "ZEC still owed"],
  ["coverage", "Reserve coverage"],
] as const;

export function ReserveScreen() {
  const { view } = useVault();
  const books = useQuery({
    queryKey: ["reserve", view.network],
    queryFn: () => api(view.network).reserve(),
    retry: false,
    enabled: view.ready,
  });

  return (
    <Page>
      <PageIntro kicker="Public books" title="Reserve" lede="Issued, used, refunded, owed, and coverage. These numbers are public. They are not tied to a person." />
      {books.isError ? <Notice>The public books are unreachable from this browser.</Notice> : null}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {ROWS.map(([key, label]) => (
          <Panel key={key} padding="card">
            <b className="block font-mono text-[20px] font-medium">
              {books.data ? books.data[key] : "—"}
            </b>
            <p className="mt-1 text-[13px] text-muted">{label}</p>
          </Panel>
        ))}
      </div>
    </Page>
  );
}
