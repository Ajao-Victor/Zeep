"use client";

import { useState } from "react";
import { CHAINS } from "@/lib/catalog";
import { isFundsError, payJson } from "@/lib/zeep/pay";
import { readSession } from "@/lib/vault/session";
import { Button } from "@/components/Button";
import { Page, PageIntro, Panel, TextField } from "@/components/Panel";
import { useVault } from "@/components/Providers";

export function ChainScreen() {
  const { view } = useVault();
  const [chain, setChain] = useState<(typeof CHAINS)[number]["id"]>("ethereum");
  const [method, setMethod] = useState("getblockcount");
  const [params, setParams] = useState("[]");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [funds, setFunds] = useState(false);
  const price = view.prices?.routes.rpc100.zats;

  async function call() {
    const session = readSession();
    if (!session || price === undefined) return;
    setBusy(true);
    setError("");
    setFunds(false);
    try {
      const parsed = JSON.parse(params) as unknown;
      const body = await payJson<unknown>(
        session.client,
        "POST",
        `/v1/rpc/${chain}`,
        { jsonrpc: "2.0", id: 1, method, params: parsed },
        BigInt(price),
      );
      setText(JSON.stringify(body, null, 2));
    } catch (cause) {
      setFunds(isFundsError(cause));
      setError(cause instanceof Error ? cause.message : "The call failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page>
      <PageIntro kicker="Chain" title="One JSON-RPC call." lede="A single call is billed as the 100-call price. The response is the node's JSON." />
      <Panel>
        <div className="flex flex-wrap gap-2">
          {CHAINS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setChain(item.id)}
              className={item.id === chain ? "rounded-full bg-gold px-3 py-1 text-[13px] text-on-gold" : "rounded-full border border-line px-3 py-1 text-[13px] text-muted"}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-3">
          <TextField label="Method" value={method} onChange={setMethod} />
          <TextField label="Params JSON" value={params} onChange={setParams} />
        </div>
        <div className="mt-4">
          <Button disabled={busy || price === undefined} onClick={() => void call()}>{busy ? "Proving…" : "Call"}</Button>
        </div>
        {error ? <p className="mt-3 text-[13px] text-danger">{error}</p> : null}
        {funds ? <Button href="/deposit" variant="secondary" className="mt-3">Add funds</Button> : null}
        {text ? <pre className="mt-4 overflow-x-auto whitespace-pre-wrap text-[13px] leading-relaxed text-muted">{text}</pre> : null}
      </Panel>
    </Page>
  );
}
