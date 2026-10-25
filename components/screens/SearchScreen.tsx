"use client";

import { useEffect, useState } from "react";
import { apiBase } from "@/lib/config";
import { formatCredits } from "@/lib/zeep";
import { isFundsError, payJson } from "@/lib/zeep/pay";
import { readSession } from "@/lib/vault/session";
import { Button } from "@/components/Button";
import { ProofButton } from "@/components/ui/ProofButton";
import { Toggle, type ToggleOption } from "@/components/ui/Toggle";
import { useForge } from "@/lib/fx/useForge";
import { Page, PageIntro, Panel, TextField } from "@/components/Panel";
import { useVault } from "@/components/Providers";

type Hit = { title?: string; url?: string; snippet?: string };
type Level = "base" | "core" | "pro";

const LEVELS: { id: Level; label: string; route: `research_${Level}` }[] = [
  { id: "base", label: "Base", route: "research_base" },
  { id: "core", label: "Core", route: "research_core" },
  { id: "pro", label: "Pro", route: "research_pro" },
];

function resultText(result: unknown): string {
  if (typeof result === "string") return result;
  if (result && typeof result === "object" && "content" in result && typeof result.content === "string") return result.content;
  return JSON.stringify(result, null, 2);
}

export function SearchScreen() {
  const { view } = useVault();
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState<Level>("base");
  const [hits, setHits] = useState<Hit[]>([]);
  const [jobId, setJobId] = useState<string | null>(null);
  const [researchStatus, setResearchStatus] = useState("");
  const [researchText, setResearchText] = useState("");
  const [busy, setBusy] = useState<"search" | "research" | null>(null);
  const [error, setError] = useState("");
  const [funds, setFunds] = useState(false);
  const forge = useForge();
  const price = view.prices?.routes.search.micro_usd;
  const levelPrice = view.prices?.routes[LEVELS.find((item) => item.id === level)?.route ?? "research_base"]?.micro_usd;
  const levelOptions: ToggleOption<Level>[] = LEVELS.map((item) => {
    const micro = view.prices?.routes[item.route]?.micro_usd;
    const credits = micro === undefined ? "" : ` · ${formatCredits(micro, view.microPerCredit)} cr`;
    return { value: item.id, label: `${item.label}${credits}` };
  });

  async function search() {
    const session = readSession();
    if (!session || price === undefined) return;
    setBusy("search");
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
      setBusy(null);
    }
  }

  useEffect(() => {
    if (!jobId || researchStatus === "completed" || researchStatus === "failed") return;
    const timer = window.setInterval(() => {
      void fetch(`${apiBase(view.network)}/v1/jobs/${jobId}`)
        .then(async (response) => {
          if (!response.ok) throw new Error(`The research job returned ${response.status}.`);
          return response.json() as Promise<{ status?: string; result?: unknown }>;
        })
        .then((body) => {
          const status = body.status ?? "running";
          setResearchStatus(status);
          if (status === "completed") setResearchText(resultText(body.result));
          if (status === "failed") setError("The research job failed.");
        })
        .catch((cause: unknown) => {
          setError(cause instanceof Error ? cause.message : "The research job did not load.");
        });
    }, 4000);
    return () => window.clearInterval(timer);
  }, [jobId, researchStatus, view.network]);

  async function research() {
    const session = readSession();
    if (!session || levelPrice === undefined) return;
    setBusy("research");
    setError("");
    setFunds(false);
    setResearchText("");
    setJobId(null);
    setResearchStatus("running");
    try {
      const body = await forge.track(() =>
        payJson<{ job_id: string }>(session.client, "POST", "/v1/research", { query, processor: level }, BigInt(levelPrice)),
      );
      setJobId(body.job_id);
    } catch (cause) {
      setResearchStatus("");
      setFunds(isFundsError(cause));
      setError(cause instanceof Error ? cause.message : "Research failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Page>
      <PageIntro kicker="Search" title="Search the web." lede="One proof pays for the query. Results stay in this tab." />
      <Panel>
        <p className="mb-3 text-[14px] text-muted">Research runs at the level you pick. Base is the short pass, Core goes further, and Pro is the longest.</p>
        <Toggle layout="chips" label="Research level" options={levelOptions} value={level} onChange={setLevel} className="mb-3" />
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="min-w-0 flex-1">
            <TextField label="Query" value={query} onChange={setQuery} />
          </div>
          <ProofButton
            className="shrink-0"
            phase={busy === "search" ? forge.phase : "idle"}
            label="Search"
            settledLabel="Found"
            disabled={busy !== null || !query.trim() || price === undefined}
            onClick={() => void search()}
          />
          <ProofButton
            className="shrink-0"
            phase={busy === "research" ? forge.phase : "idle"}
            label="Research"
            settledLabel="Started"
            disabled={busy !== null || !query.trim() || levelPrice === undefined}
            onClick={() => void research()}
          />
        </div>
        {researchStatus === "running" ? <p className="mt-3 text-[13px] text-muted">Research is running…</p> : null}
        {researchText ? <pre className="mt-4 overflow-x-auto whitespace-pre-wrap text-[13px] leading-relaxed text-muted">{researchText}</pre> : null}
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
