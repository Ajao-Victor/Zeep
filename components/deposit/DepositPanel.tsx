"use client";

import { useEffect, useState } from "react";
import { formatCredits, formatZec, parseZec, creditsToZats } from "@/lib/zeep";
import type { DepositStatus } from "@/lib/zeep/client";
import { zip321 } from "@/lib/zcash/zip321";
import { payFromWallet, walletSummary } from "@/lib/zcash/wallet";
import { emit, readSession } from "@/lib/vault/session";
import { Button } from "@/components/Button";
import { CopyField } from "@/components/CopyField";
import { Notice, TextField } from "@/components/Panel";
import { QRPay } from "@/components/QRPay";
import { useVault } from "@/components/Providers";

export function DepositPanel({ onDone }: { onDone?: () => void }) {
  const { view } = useVault();
  const [amount, setAmount] = useState("0.1");
  const [creditHint, setCreditHint] = useState("");
  const [status, setStatus] = useState<(DepositStatus & { slot: number }) | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [walletZec, setWalletZec] = useState<string | null>(null);

  useEffect(() => {
    const session = readSession();
    if (!session) return;
    void walletSummary(session.phrase, view.network)
      .then((summary) => {
        const current = readSession();
        if (current) {
          current.walletZats = summary.zats;
          current.receiveAddress = summary.address;
          emit();
        }
        setWalletZec(summary.zats > 0n ? formatZec(summary.zats) : null);
      })
      .catch(() => setWalletZec(null));
  }, [view.network]);

  function onAmount(value: string) {
    setAmount(value);
    const per = view.zatsPerCredit || 10_000;
    try {
      setCreditHint(`${formatCredits(parseZec(value), per)} cr`);
    } catch {
      const asCredits = Number(value);
      if (Number.isFinite(asCredits) && asCredits > 0) {
        setCreditHint(`${formatZec(creditsToZats(asCredits, per))} ZEC`);
      } else setCreditHint("");
    }
  }

  async function start() {
    const session = readSession();
    if (!session) return;
    setError("");
    setBusy("Reserving an address…");
    try {
      let zats: bigint | undefined;
      try {
        zats = parseZec(amount);
      } catch {
        const credits = Number(amount);
        if (!Number.isFinite(credits) || credits <= 0) throw new Error("Enter an amount in ZEC, or a number of credits.");
        zats = creditsToZats(credits, view.zatsPerCredit || 10_000);
      }
      const created = await session.client.startDeposit(zats);
      setStatus(created);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The deposit could not start.");
    } finally {
      setBusy("");
    }
  }

  useEffect(() => {
    if (!status || status.status === "credited" || status.status === "expired") return;
    const timer = window.setInterval(() => {
      const session = readSession();
      if (!session) return;
      void session.client.depositStatus(status.slot).then((next) => setStatus({ ...next, slot: status.slot })).catch(() => {});
    }, 4000);
    return () => window.clearInterval(timer);
  }, [status]);

  async function payHere() {
    const session = readSession();
    if (!session || !status) return;
    setBusy("Paying from this wallet…");
    setError("");
    try {
      const zats = status.expected_zats ? BigInt(status.expected_zats) : parseZec(amount);
      await payFromWallet(session.phrase, view.network, status.address, zats);
      setBusy("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The wallet payment did not send.");
      setBusy("");
    }
  }

  const zecAmount = status?.expected_zats ? formatZec(status.expected_zats) : amount;
  const uri = status ? zip321(status.address, zecAmount) : "";

  return (
    <div className="grid gap-4">
      {!status ? (
        <>
          <TextField label="Amount in ZEC, or credits" value={amount} onChange={onAmount} placeholder="0.1" />
          {creditHint ? <p className="text-[13px] text-muted">{creditHint}. 0.1 ZEC is 1,000 credits.</p> : null}
          {walletZec ? <p className="text-[13px] text-muted">In-app wallet: {walletZec} ZEC</p> : null}
          {error ? <p className="text-[13px] text-danger">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button disabled={Boolean(busy)} onClick={() => void start()}>{busy || "Create deposit address"}</Button>
            {onDone ? <Button variant="secondary" onClick={onDone}>Skip for now</Button> : null}
          </div>
        </>
      ) : (
        <>
          <Notice tone={status.status === "credited" ? "ok" : "warn"}>
            {status.status === "waiting" ? "Waiting for the payment." : null}
            {status.status === "confirming"
              ? `Confirming ${status.confirming[0]?.confirmations ?? 0}/${status.confirming[0]?.needed ?? 3}.`
              : null}
            {status.status === "credited" ? `Credited ${formatZec(status.credited?.amount_zats ?? 0)} ZEC.` : null}
            {status.status === "expired" ? "This address expired. Start another deposit." : null}
          </Notice>
          <div className="flex flex-wrap gap-2">
            <Button disabled={Boolean(busy) || !walletZec} onClick={() => void payHere()}>{busy || "Pay from this wallet"}</Button>
          </div>
          {uri ? <QRPay uri={uri} caption="Or send this amount from any wallet. No memo." /> : <CopyField label="Address" value={status.address} />}
          {error ? <p className="text-[13px] text-danger">{error}</p> : null}
          {onDone && status.status === "credited" ? <Button onClick={onDone}>Continue</Button> : null}
        </>
      )}
    </div>
  );
}
