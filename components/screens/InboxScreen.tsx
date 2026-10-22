"use client";

import { useState } from "react";
import { apiBase } from "@/lib/config";
import { isFundsError, readPaid } from "@/lib/zeep/pay";
import { readSession } from "@/lib/vault/session";
import { setInbox } from "@/lib/vault/vault";
import { Button } from "@/components/Button";
import { CopyField } from "@/components/CopyField";
import { Page, PageIntro, Panel } from "@/components/Panel";
import { useVault } from "@/components/Providers";
import { ProofButton } from "@/components/ui/ProofButton";
import { useForge } from "@/lib/fx/useForge";

type Message = { id?: string; memo?: string; amount?: string; created_at?: string };

export function InboxScreen() {
  const { view } = useVault();
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [funds, setFunds] = useState(false);
  const forge = useForge();
  const price = view.prices?.routes.inbox.micro_usd;

  async function create() {
    const session = readSession();
    if (!session || price === undefined) return;
    setBusy("Opening…");
    setError("");
    setFunds(false);
    try {
      const response = await forge.track(() => session.client.pay("POST", "/v1/inbox", "", BigInt(price)));
      const body = await readPaid<{ inbox_id: string; address: string }>(response);
      await setInbox(body.inbox_id, body.address);
    } catch (cause) {
      setFunds(isFundsError(cause));
      setError(cause instanceof Error ? cause.message : "The inbox did not open.");
    } finally {
      setBusy("");
    }
  }

  async function refresh() {
    if (!view.inboxId) return;
    setBusy("Reading…");
    setError("");
    try {
      const response = await fetch(`${apiBase(view.network)}/v1/inbox/${view.inboxId}/messages`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = (await response.json()) as { messages?: Message[] };
      setMessages(body.messages ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Messages did not load.");
    } finally {
      setBusy("");
    }
  }

  return (
    <Page>
      <PageIntro kicker="Inbox" title="An address with no name on it." lede="Opening it takes one proof. Reading messages is free." />
      <Panel>
        {view.inboxAddress ? (
          <>
            <CopyField label="Address" value={view.inboxAddress} />
            <div className="mt-4">
              <Button disabled={Boolean(busy)} onClick={() => void refresh()}>{busy || "Refresh messages"}</Button>
            </div>
          </>
        ) : (
          <ProofButton phase={forge.phase} label="Open an inbox" settledLabel="Opened" disabled={Boolean(busy) || price === undefined} onClick={() => void create()} />
        )}
        {error ? <p className="mt-3 text-[13px] text-danger">{error}</p> : null}
        {funds ? <Button href="/deposit" variant="secondary" className="mt-3">Add funds</Button> : null}
        <ul className="mt-4 grid gap-3">
          {messages.map((message, index) => (
            <li key={message.id ?? index} className="rounded-lg border border-line px-3 py-2 text-[13px] text-muted">
              {message.memo || message.amount || "Payment"}
            </li>
          ))}
        </ul>
      </Panel>
    </Page>
  );
}
