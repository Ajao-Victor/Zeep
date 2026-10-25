"use client";

import { useEffect, useState } from "react";
import { formatCredits, formatZec, parseZec, zatsToMicroUsd, type WithdrawalPlan } from "@/lib/zeep";
import { isFundsError } from "@/lib/zeep/pay";
import type { FeeSheet } from "@/lib/zeep/prices";
import { addressKind } from "@/lib/zcash/address";
import { readSession } from "@/lib/vault/session";
import { writePending } from "@/lib/account/pending";
import { Button } from "@/components/Button";
import { Reauth } from "@/components/flows/Reauth";
import { Page, PageIntro, Panel, TextField } from "@/components/Panel";
import { useVault } from "@/components/Providers";
import { ProofButton } from "@/components/ui/ProofButton";
import { useForge } from "@/lib/fx/useForge";

type Watch = {
  id: string;
  status: string;
  message?: string;
  warning?: string;
  zec_received_zats?: number | null;
  estimated_zec_zats?: number | null;
  network_fees_paid_by?: string;
  tranches?: { tranche: number; status: string; txid: string | null; amount_zats: number }[];
};

export function CreditsScreen() {
  const { view } = useVault();
  const [amount, setAmount] = useState("");
  const [max, setMax] = useState(false);
  const [address, setAddress] = useState("");
  const [allowTransparent, setAllowTransparent] = useState(false);
  const [fees, setFees] = useState<FeeSheet | null>(null);
  const [plan, setPlan] = useState<WithdrawalPlan | null>(null);
  const [stage, setStage] = useState<"form" | "confirm" | "reauth">("form");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [funds, setFunds] = useState(false);
  const forge = useForge();
  const [watch, setWatch] = useState<Watch | null>(null);

  useEffect(() => {
    const session = readSession();
    if (!session) return;
    void session.client.fees().then((sheet) => setFees(sheet as FeeSheet)).catch(() => {});
  }, [view.network]);

  useEffect(() => {
    if (!watch || watch.status === "done" || watch.status === "failed") return;
    const timer = window.setInterval(() => {
      const session = readSession();
      if (!session) return;
      void session.client.withdrawalStatus(watch.id).then((next) => {
        setWatch((current) => current && current.id === watch.id ? {
          ...current,
          ...next,
          id: watch.id,
          estimated_zec_zats: next.estimated_zec_zats ?? current.estimated_zec_zats,
          network_fees_paid_by: next.network_fees_paid_by ?? current.network_fees_paid_by,
        } : current);
      }).catch(() => {});
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [watch]);

  useEffect(() => {
    const session = readSession();
    if (!session) return;
    const active = watch?.status === "converting" || watch?.status === "paying";
    void writePending(session.network, { withdrawal: active });
  }, [watch]);

  const kind = addressKind(address, view.network);
  const feePct = (fees?.withdrawal.fee_bps ?? 150) / 100;
  const beside = (() => {
    if (max) return "Everything you hold";
    if (!view.prices) return "";
    try {
      const zats = parseZec(amount);
      return `≈ ${formatCredits(zatsToMicroUsd(zats, view.prices.zec_usd), view.microPerCredit)} cr`;
    } catch {
      return "";
    }
  })();

  function resetPlan() {
    setPlan(null);
    setStage("form");
  }

  async function review() {
    const session = readSession();
    if (!session) return;
    setError("");
    setFunds(false);
    setWatch(null);
    if (kind === "invalid") {
      setError(address.trim() ? "That address is not valid on this network." : "Paste a Zcash address.");
      return;
    }
    if (kind === "transparent" && !allowTransparent) {
      setError("A transparent address needs the confirmation below.");
      return;
    }
    setBusy("Checking the withdrawal…");
    try {
      const next = await session.client.planWithdrawal(max ? "all" : parseZec(amount));
      setPlan(next);
      if (next.needsConversion) setStage("confirm");
      else await send(next);
    } catch (cause) {
      setFunds(isFundsError(cause));
      setError(cause instanceof Error ? cause.message : "The withdrawal could not be planned.");
    } finally {
      setBusy("");
    }
  }

  async function send(chosen: WithdrawalPlan) {
    const session = readSession();
    if (!session) return;
    setBusy("Proving the withdrawal…");
    setError("");
    try {
      const outcome = await forge.track(() => session.client.withdraw(chosen, address.trim(), { allowTransparent: kind === "transparent" }));
      const id = String(outcome.withdrawal_id ?? outcome.id ?? "");
      setWatch({
        id,
        status: String(outcome.status ?? ""),
        message: outcome.processing?.message ?? outcome.message,
        warning: outcome.warning,
        zec_received_zats: outcome.zec_received_zats ?? null,
        estimated_zec_zats: outcome.estimated_zec_zats ?? null,
        network_fees_paid_by: outcome.network_fees_paid_by,
        tranches: outcome.tranches,
      });
      setAmount("");
      setMax(false);
      resetPlan();
    } catch (cause) {
      setFunds(isFundsError(cause));
      setError(cause instanceof Error ? cause.message : "The withdrawal failed.");
    } finally {
      setBusy("");
    }
  }

  return (
    <Page narrow>
      <PageIntro kicker="Balance" title={`${view.creditLabel} cr`} lede="Dollars plus ZEC at the live price. 1 credit is $1." />
      <Panel>
        <div className="grid gap-1 text-[14px] text-muted">
          <p>Credits (dollars): {view.usdLabel}</p>
          <p>ZEC: {view.zecHeldLabel} ZEC ≈ {view.zecValueLabel}</p>
          <p>Total: {view.creditLabel} cr</p>
        </div>
      </Panel>
      <Panel>
        <p className="text-[14px] text-muted">
          Withdraw in ZEC. A converted part is at least $1, and the total must be worth at least $1.
        </p>
        <p className="mt-2 text-[13px] text-faint">The amount you receive is after network fees.</p>
        {stage === "form" ? (
          <div className="mt-4 grid gap-3">
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <TextField label="Amount in ZEC" value={max ? "Max" : amount} onChange={(value) => { setMax(false); setAmount(value); }} placeholder="0.01" />
              </div>
              <Button variant="secondary" onClick={() => { setMax(true); setAmount(""); }}>Max</Button>
            </div>
            {beside ? <p className="text-[13px] text-muted">{beside}</p> : null}
            <TextField label="Zcash address" value={address} onChange={(value) => { setAddress(value); setAllowTransparent(false); }} />
            {kind === "transparent" ? (
              <label className="flex items-start gap-2 text-[13px] text-muted">
                <input type="checkbox" className="mt-1" checked={allowTransparent} onChange={(event) => setAllowTransparent(event.target.checked)} />
                <span>I understand the amount and recipient will be public.</span>
              </label>
            ) : null}
          </div>
        ) : null}
        {stage !== "form" && plan ? (
          <div className="mt-4 grid gap-3 text-[14px] leading-relaxed text-muted">
            <p>
              Your ZEC balance covers {formatZec(plan.zecZats)} ZEC. To withdraw the rest, {formatCredits(plan.usdMicro, view.microPerCredit)} credits will be converted back to ZEC (fee {formatCredits(plan.conversionFeeMicro, view.microPerCredit)} credits, {feePct}%). This takes 20–60 minutes; the ZEC arrives shielded and is sent automatically.
            </p>
            <p>You'll receive about {formatZec(plan.estimatedZats)} ZEC. With a conversion, the final amount depends on the conversion rate.</p>
            <p>
              {plan.networkFeesCovered
                ? "Network fees: covered (first withdrawal today)."
                : `Network fees: ${formatZec(plan.networkFeeZats)} ZEC.`}
            </p>
            {stage === "reauth" ? (
              <Reauth onSuccess={() => void send(plan)} onCancel={resetPlan} />
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button disabled={Boolean(busy)} onClick={() => setStage("reauth")}>Convert and withdraw</Button>
                <Button variant="secondary" onClick={resetPlan}>Cancel</Button>
              </div>
            )}
          </div>
        ) : null}
        {error ? <p className="mt-3 text-[13px] text-danger">{error}</p> : null}
        {watch ? (
          <div className="mt-3 grid gap-1 text-[13px] text-muted">
            {watch.message ? <p>{watch.status === "converting" ? "Processing… " : ""}{watch.message}</p> : <p>Status: {watch.status}.</p>}
            {watch.estimated_zec_zats != null ? <p>You'll receive about {formatZec(watch.estimated_zec_zats)} ZEC.</p> : null}
            {watch.network_fees_paid_by ? (
              <p>{watch.network_fees_paid_by === "zeep" ? "Network fees: covered." : "Network fees: paid from the ZEC."}</p>
            ) : null}
            {watch.zec_received_zats ? <p>ZEC received: {formatZec(watch.zec_received_zats)}.</p> : null}
            {watch.warning ? <p className="text-warn">{watch.warning}</p> : null}
            {(watch.tranches ?? []).map((tranche) => (
              <p key={tranche.tranche}>
                Tranche {tranche.tranche}: {tranche.status}
                {tranche.txid ? ` ${tranche.txid}` : ""}
              </p>
            ))}
          </div>
        ) : null}
        {stage === "form" ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <ProofButton
              phase={forge.phase}
              label="Withdraw"
              settledLabel="Requested"
              disabled={Boolean(busy) || (!max && !amount.trim()) || !address.trim()}
              onClick={() => void review()}
            />
            <Button href="/deposit" variant="secondary">Deposit</Button>
            {funds ? <Button href="/deposit" variant="secondary">Add funds</Button> : null}
            {/* Planning makes no proof, so it is plain text beside the button, not a Forge phase. */}
            {busy && forge.phase === "idle" ? <span className="self-center text-[13px] text-muted">{busy}</span> : null}
          </div>
        ) : null}
      </Panel>
    </Page>
  );
}
