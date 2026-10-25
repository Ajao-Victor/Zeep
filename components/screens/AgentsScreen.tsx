"use client";

import { useState } from "react";
import { SERVICES } from "@/lib/catalog";
import { fromHex } from "@/lib/bytes";
import { parseZec, ZEC } from "@/lib/zeep";
import { isFundsError } from "@/lib/zeep/pay";
import { readSession } from "@/lib/vault/session";
import { Button } from "@/components/Button";
import { Page, PageIntro, Panel, TextField } from "@/components/Panel";
import { useVault } from "@/components/Providers";
import { ProofButton } from "@/components/ui/ProofButton";
import { useForge } from "@/lib/fx/useForge";

export function AgentsScreen() {
  const { view } = useVault();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("0.001");
  const [pk, setPk] = useState("");
  const [noteKey, setNoteKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [funds, setFunds] = useState(false);
  const forge = useForge();

  async function fund() {
    const session = readSession();
    if (!session) return;
    setBusy(true);
    setError("");
    setFunds(false);
    try {
      const zats = parseZec(amount);
      const key = noteKey.trim() ? fromHex(noteKey.trim()) : undefined;
      await forge.track(() => session.client.fund(ZEC, BigInt(pk.trim()), zats, key));
      setName("");
    } catch (cause) {
      setFunds(isFundsError(cause));
      setError(cause instanceof Error ? cause.message : "The transfer failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page narrow>
      <PageIntro kicker="Agents" title="Move ZEC notes to another spend key." lede="The transfer is one spend proof. The recipient's note key lets them read the output." />
      <Panel>
        <div className="grid gap-3">
          <TextField label="Label, kept on this device" value={name} onChange={setName} />
          <TextField label="Amount in ZEC" value={amount} onChange={setAmount} />
          <TextField label="Recipient spend key (decimal)" value={pk} onChange={setPk} />
          <TextField label="Recipient note key (hex, optional)" value={noteKey} onChange={setNoteKey} />
        </div>
        <p className="mt-3 text-[13px] text-faint">Services this key can call: {SERVICES.map((service) => service.name).join(", ")}.</p>
        {error ? <p className="mt-3 text-[13px] text-danger">{error}</p> : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <ProofButton phase={forge.phase} label="Transfer" settledLabel="Moved" disabled={busy || !pk.trim()} onClick={() => void fund()} />
          {funds ? <Button href="/wallet?action=deposit" variant="secondary">Add funds</Button> : null}
        </div>
      </Panel>
    </Page>
  );
}
