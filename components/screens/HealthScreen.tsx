"use client";

import { useState } from "react";
import { isFundsError, payJson } from "@/lib/zeep/pay";
import { readSession } from "@/lib/vault/session";
import { Button } from "@/components/Button";
import { QueryBar, ResultList } from "@/components/find/QueryBar";
import { Page } from "@/components/Panel";
import { Toggle, type ToggleOption } from "@/components/ui/Toggle";
import { useVault } from "@/components/Providers";
import { useForge } from "@/lib/fx/useForge";

const KINDS: ToggleOption<"drug" | "trial">[] = [
  { value: "drug", label: "Drug" },
  { value: "trial", label: "Trial" },
];

function healthView(body: unknown): { summary?: string; disclaimer?: string; items: { title: string; url?: string; snippet?: string }[] } {
  if (!body || typeof body !== "object") return { items: typeof body === "string" ? [{ title: "Result", snippet: body }] : [] };
  const record = body as { summary?: unknown; disclaimer?: unknown; data?: unknown };
  const summary = typeof record.summary === "string" ? record.summary : undefined;
  const disclaimer = typeof record.disclaimer === "string" ? record.disclaimer : undefined;
  const data = record.data;
  const rows = Array.isArray(data)
    ? data
    : data && typeof data === "object" && Array.isArray((data as { results?: unknown }).results)
      ? (data as { results: unknown[] }).results
      : [];
  const items = rows.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const item = row as { name?: unknown; title?: unknown; summary?: unknown; snippet?: unknown; url?: unknown };
    const title = typeof item.name === "string" ? item.name : typeof item.title === "string" ? item.title : "";
    if (!title) return [];
    return [{
      title,
      url: typeof item.url === "string" ? item.url : undefined,
      snippet: typeof item.summary === "string" ? item.summary : typeof item.snippet === "string" ? item.snippet : undefined,
    }];
  });
  return { summary, disclaimer, items };
}

export function HealthScreen() {
  const { view } = useVault();
  const [kind, setKind] = useState<"drug" | "trial">("drug");
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState<ReturnType<typeof healthView> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [funds, setFunds] = useState(false);
  const forge = useForge();
  const price = view.prices?.routes.health.micro_usd;

  async function lookup() {
    const session = readSession();
    if (!session || price === undefined) return;
    setBusy(true);
    setError("");
    setFunds(false);
    try {
      const body = await forge.track(() =>
        payJson<unknown>(session.client, "POST", "/v1/health/lookup", { kind, query, summarize: true }, BigInt(price)),
      );
      setAnswer(healthView(body));
    } catch (cause) {
      setFunds(isFundsError(cause));
      setError(cause instanceof Error ? cause.message : "The lookup failed.");
    } finally {
      setBusy(false);
    }
  }

  const asked = answer !== null;

  return (
    <Page>
      <div className={asked ? "mx-auto max-w-3xl" : "mx-auto flex min-h-[62vh] max-w-2xl flex-col justify-center"}>
        <h1 className={asked ? "sr-only" : "mb-6 text-center text-[40px] font-semibold tracking-[-0.03em]"}>Health</h1>
        <Toggle layout="chips" label="Lookup type" options={KINDS} value={kind} onChange={setKind} className={asked ? "mb-4" : "mb-4 justify-center"} />
        <QueryBar
          value={query}
          onChange={setQuery}
          onSubmit={() => void lookup()}
          placeholder={kind === "drug" ? "Look up a drug" : "Look up a trial"}
          label="Question"
          phase={busy ? forge.phase : "idle"}
          disabled={busy || !query.trim() || price === undefined}
          submitLabel="Look up"
          settledLabel="Answered"
        />
        <p className={asked ? "mt-3 text-[12px] text-faint" : "mt-3 text-center text-[12px] text-faint"}>Reference information only, not a diagnosis.</p>
        {error ? <p className="mt-4 text-[13px] text-danger">{error}</p> : null}
        {funds ? <Button href="/wallet?action=deposit" variant="secondary" className="mt-4">Add funds</Button> : null}
        {answer?.summary ? <p className="mt-8 max-w-2xl text-[15px] leading-relaxed text-text">{answer.summary}</p> : null}
        {answer ? <ResultList items={answer.items} /> : null}
        {answer?.disclaimer ? <p className="mt-6 text-[12px] text-faint">{answer.disclaimer}</p> : null}
      </div>
    </Page>
  );
}
