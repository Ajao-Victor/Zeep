"use client";

import { useState } from "react";
import { isFundsError, payJson } from "@/lib/zeep/pay";
import { readSession } from "@/lib/vault/session";
import { Button } from "@/components/Button";
import { ProofButton } from "@/components/ui/ProofButton";
import { useForge } from "@/lib/fx/useForge";
import { Page, PageIntro, Panel, TextField } from "@/components/Panel";
import { useVault } from "@/components/Providers";

type Hit = { title?: string; url?: string; snippet?: string };

export function SearchScreen() {
  const { view } = useVault();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [funds, setFunds] = useState(false);
  const forge = useForge();
  const price = view.prices?.routes.search.micro_usd;

  async function search() {
    const session = readSession();
    if (!session || price === undefined) return;
    setBusy(true);
    setError("");
    setFunds(false);
    try {
      const body = await forge.track(() =>
        payJson<{ results?: Hit[]; hits?: Hit[] }>(session.client, "POST", "/v1/search", { query }, BigInt(price)),
      );
      setHits(body.results ?? body.hits ?? []);
    } catch (cause) {
      setFunds(isFundsError(cause));
      setError(cause instanceof Error ? cause.message : "Search failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page>
      <PageIntro kicker="Search" title="Search the web." lede="One proof pays for the query. Results stay in this tab." />
      <Panel>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="min-w-0 flex-1">
            <TextField label="Query" value={query} onChange={setQuery} />
          </div>
          <ProofButton
            className="shrink-0"
            phase={forge.phase}
            label="Search"
            settledLabel="Found"
            disabled={busy || !query.trim() || price === undefined}
            onClick={() => void search()}
          />
        </div>
        {error ? <p className="mt-3 text-[13px] text-danger">{error}</p> : null}
        {funds ? <Button href="/deposit" variant="secondary" className="mt-3">Add funds</Button> : null}
      </Panel>
      <ul className="mt-4 grid gap-3">
        {hits.map((hit, index) => (
          <li key={hit.url ?? index} className="rounded-xl border border-line bg-surface p-4">
            <a href={hit.url} className="text-[15px] text-gold hover:underline" target="_blank" rel="noreferrer">{hit.title || hit.url}</a>
            {hit.snippet ? <p className="mt-2 text-[14px] leading-relaxed text-muted">{hit.snippet}</p> : null}
          </li>
        ))}
      </ul>
    </Page>
  );
}
