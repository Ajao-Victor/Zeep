"use client";

import { useEffect, useState } from "react";
import { estimateDeposit, formatCredits, formatUsd, formatZec, parseZec } from "@/lib/zeep";
import type { DepositStatus } from "@/lib/zeep/client";
import { zip321 } from "@/lib/zcash/zip321";
import { readWalletBirthday } from "@/lib/zcash/birthday";
import { payFromWallet, walletSummary } from "@/lib/zcash/wallet";
import { readSession } from "@/lib/vault/session";
import { writePending } from "@/lib/account/pending";
import { Button } from "@/components/Button";
import { CopyField } from "@/components/CopyField";
import { Notice, TextField } from "@/components/Panel";
import { QRPay } from "@/components/QRPay";
import { useVault } from "@/components/Providers";

type Split = { shareBps: number; feeBps: number };

export function DepositPanel({ onDone }: { onDone?: () => void }) {
  const { view } = useVault();
  const [amount, setAmount] = useState("0.1");
  const [split, setSplit] = useState<Split | null>(null);
  const [status, setStatus] = useState<(DepositStatus & { slot: number }) | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [canPayHere, setCanPayHere] = useState(false);

  useEffect(() => {
    const session = readSession();
    if (!session) return;
    void session.client.config().then((conf) => {
      const share = Number(conf?.split?.zec_share_bps);
      const fee = Number(conf?.deposits?.fee_bps ?? conf?.split?.conversion_fee_bps?.zec_to_usd);
      if (Number.isFinite(share) && Number.isFinite(fee)) setSplit({ shareBps: share, feeBps: fee });
    }).catch(() => {});
    void (async () => {
      const birthday = (await readWalletBirthday(session.network, session.keys)) ?? 0;
      try {
        const summary = await walletSummary(session.phrase, view.network, birthday);
        setCanPayHere(summary.shieldedZats > 0n || summary.transparentZats > 0n);
      } catch {
        setCanPayHere(false);
      }
    })();
  }, [view.network]);

  const estimate = (() => {
    const prices = view.prices;
    if (!prices || !split) return null;
    try {
      return estimateDeposit(parseZec(amount), prices.zec_usd, split.shareBps, split.feeBps);
    } catch {
      return null;
    }
  })();

  async function start() {
    const session = readSession();
    if (!session) return;
    setError("");
    setBusy("Reserving an address…");
    try {
      const zats = parseZec(amount);
      if (zats <= 0n) throw new Error("Enter an amount in ZEC.");
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

  useEffect(() => {
    const session = readSession();
    if (!session || !status) return;
    const active = status.status === "waiting" || status.status === "confirming";
    void writePending(session.network, { deposit: active });
  }, [status]);

  async function payHere() {
    const session = readSession();
    if (!session || !status) return;
    setBusy("Paying from this wallet…");
    setError("");
    try {
      const zats = status.expected_zats ? BigInt(status.expected_zats) : parseZec(amount);
      const birthday = (await readWalletBirthday(session.network, session.keys)) ?? 0;
      await payFromWallet(session.phrase, view.network, status.address, zats, birthday);
      setBusy("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The wallet payment did not send.");
      setBusy("");
    }
  }

  const zecAmount = status?.expected_zats ? formatZec(status.expected_zats) : amount;
  const uri = status ? zip321(status.address, zecAmount) : "";
  const credited = status?.credited;
  const keptZats = estimate ? parseZec(amount) - estimate.zecZats : 0n;

  return (
    <div className="grid gap-4">
      {!status ? (
        <>
          <TextField label="Amount in ZEC" value={amount} onChange={setAmount} placeholder="0.1" />
          {estimate ? (
            <div className="text-[13px] leading-relaxed text-muted">
              <p>≈ {formatCredits(estimate.totalMicro, view.microPerCredit)} credits</p>
              <p className="mt-1 text-faint">
                {formatZec(estimate.zecZats)} ZEC kept as ZEC · {formatZec(keptZats)} ZEC → {formatUsd(estimate.usdMicro)} ({(split?.feeBps ?? 0) / 100}% conversion fee). Estimate: the dollar half is fixed when the deposit confirms.
              </p>
            </div>
          ) : (
            <p className="text-[13px] text-faint">The split appears once prices load.</p>
          )}
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
            {status.status === "expired" ? "This address expired. Start another deposit." : null}
            {status.status === "credited" && credited ? "Credited." : null}
          </Notice>
          {credited ? (
            <div className="grid gap-1 text-[13px] leading-relaxed text-muted">
              <p>Received {formatZec(credited.zec_zats)} ZEC at ${credited.zec_usd}.</p>
              <p>Kept as ZEC: {formatZec(credited.zec.amount_zats)}.</p>
              <p>
                Converted: {formatZec(credited.usd.converted_zats)} → {formatUsd(credited.usd.value_micro_usd)}, fee {formatUsd(credited.usd.fee_micro_usd)}
                {credited.usd.rebate_micro_usd > 0 ? `, network fee back ${formatUsd(credited.usd.rebate_micro_usd)}` : ""}.
              </p>
              <p>Dollar note: {formatUsd(credited.usd.amount_micro_usd)}.</p>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button disabled={Boolean(busy) || !canPayHere || status.status === "credited"} onClick={() => void payHere()}>{busy || "Pay from this wallet"}</Button>
          </div>
          {uri && status.status !== "credited" ? <QRPay uri={uri} caption="Or send this amount from any wallet. No memo." /> : <CopyField label="Address" value={status.address} />}
          {error ? <p className="text-[13px] text-danger">{error}</p> : null}
          {onDone && status.status === "credited" ? <Button onClick={onDone}>Continue</Button> : null}
        </>
      )}
    </div>
  );
}
