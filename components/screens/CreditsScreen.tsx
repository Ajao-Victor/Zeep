"use client";

import { useState } from "react";
import { formatCredits, formatZec, parseZec } from "@/lib/zeep";
import { isFundsError } from "@/lib/zeep/pay";
import { readSession } from "@/lib/vault/session";
import { Button } from "@/components/Button";
import { Page, PageIntro, Panel, TextField } from "@/components/Panel";
import { useVault } from "@/components/Providers";

const MIN = 20_002n;

export function CreditsScreen() {
  const { view } = useVault();
  const [amount, setAmount] = useState("");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const [funds, setFunds] = useState(false);

  async function withdraw() {
    const session = readSession();
    if (!session) return;
    setError("");
    setFunds(false);
    setResult("");
    let zats: bigint;
    try {
      zats = parseZec(amount);
    } catch {
      setError("Enter the amount in ZEC.");
      return;
    }
    if (zats < MIN) {
      setError(`The minimum is ${formatZec(MIN)} ZEC.`);
      return;
    }
    setBusy("Proving the withdrawal…");
    try {
      const outcome = await session.client.withdraw(zats, address.trim());
      setResult(`Withdrawal ${outcome.id} pays out in two parts, about 10 and 20 minutes apart.`);
      setAmount("");
    } catch (cause) {
      setFunds(isFundsError(cause));
      setError(cause instanceof Error ? cause.message : "The withdrawal failed.");
    } finally {
      setBusy("");
    }
  }

  return (
    <Page narrow>
      <PageIntro kicker="Balance" title={`${view.creditLabel} cr`} lede={`${view.zecLabel} ZEC. Credits are only how this number is shown.`} />
      <Panel>
        <p className="text-[14px] text-muted">Withdraw any amount of at least {formatZec(MIN)} ZEC ({formatCredits(MIN, view.zatsPerCredit)} cr) to a shielded address.</p>
        <div className="mt-4 grid gap-3">
          <TextField label="Amount in ZEC" value={amount} onChange={setAmount} placeholder="0.01" />
          <TextField label="Shielded address" value={address} onChange={setAddress} />
        </div>
        {error ? <p className="mt-3 text-[13px] text-danger">{error}</p> : null}
        {result ? <p className="mt-3 text-[13px] text-ok">{result}</p> : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button disabled={Boolean(busy) || !address.trim()} onClick={() => void withdraw()}>{busy || "Withdraw"}</Button>
          <Button href="/deposit" variant="secondary">Deposit</Button>
          {funds ? <Button href="/deposit" variant="secondary">Add funds</Button> : null}
        </div>
      </Panel>
    </Page>
  );
}
