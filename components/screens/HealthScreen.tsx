"use client";

import { useState } from "react";
import { isFundsError, payJson } from "@/lib/zeep/pay";
import { readSession } from "@/lib/vault/session";
import { Button } from "@/components/Button";
import { Page, PageIntro, Panel, TextField } from "@/components/Panel";
import { useVault } from "@/components/Providers";

export function HealthScreen() {
  const { view } = useVault();
  const [kind, setKind] = useState<"drug" | "trial">("drug");
  const [query, setQuery] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [funds, setFunds] = useState(false);
  const price = view.prices?.routes.health.micro_usd;

  async function lookup() {
    const session = readSession();
    if (!session || price === undefined) return;
    setBusy(true);
    setError("");
    setFunds(false);
    try {
      const body = await payJson<unknown>(session.client, "POST", "/v1/health/lookup", { kind, query, summarize: true }, BigInt(price));
      setText(typeof body === "string" ? body : JSON.stringify(body, null, 2));
    } catch (cause) {
      setFunds(isFundsError(cause));
      setError(cause instanceof Error ? cause.message : "The lookup failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page>
      <PageIntro kicker="Health" title="Look up a condition." lede="The answer is general information, not a diagnosis." />
      <Panel>
        <div className="mb-3 flex gap-2">
          <button type="button" onClick={() => setKind("drug")} className={kind === "drug" ? "rounded-full bg-gold px-3 py-1 text-[13px] text-on-gold" : "rounded-full border border-line px-3 py-1 text-[13px] text-muted"}>Drug</button>
          <button type="button" onClick={() => setKind("trial")} className={kind === "trial" ? "rounded-full bg-gold px-3 py-1 text-[13px] text-on-gold" : "rounded-full border border-line px-3 py-1 text-[13px] text-muted"}>Trial</button>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="min-w-0 flex-1">
            <TextField label="Question" value={query} onChange={setQuery} />
          </div>
          <Button className="shrink-0" disabled={busy || !query.trim() || price === undefined} onClick={() => void lookup()}>
            {busy ? "Proving…" : "Look up"}
          </Button>
        </div>
        {error ? <p className="mt-3 text-[13px] text-danger">{error}</p> : null}
        {funds ? <Button href="/deposit" variant="secondary" className="mt-3">Add funds</Button> : null}
        {text ? <pre className="mt-4 overflow-x-auto whitespace-pre-wrap text-[13px] leading-relaxed text-muted">{text}</pre> : null}
      </Panel>
    </Page>
  );
}
