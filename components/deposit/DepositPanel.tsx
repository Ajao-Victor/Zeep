"use client";

import { useEffect, useRef, useState } from "react";
import { rememberActivity } from "@/lib/account/activity";
import { estimateDeposit, formatCredits, formatUsd, formatZec, parseZec } from "@/lib/zeep";
import type { DepositStatus } from "@/lib/zeep/client";
import { zip321 } from "@/lib/zcash/zip321";
import { readWalletBirthday } from "@/lib/zcash/birthday";
import { payFromWallet, walletSummary } from "@/lib/zcash/wallet";
import { readSession } from "@/lib/vault/session";
import { writePending } from "@/lib/account/pending";
import { Button } from "@/components/Button";
import { Notice, TextField } from "@/components/Panel";
import { QRPay } from "@/components/QRPay";
import { useVault } from "@/components/Providers";

type Split = { shareBps: number; feeBps: number };
type Shown = DepositStatus & { slot: number };

function queuedText(queued: NonNullable<DepositStatus["queued"]>): string {
  if (queued.reason === "crediting") return "Received, crediting…";
  const date = queued.until ? new Date(queued.until) : null;
  const when = date && !Number.isNaN(date.getTime()) ? date.toLocaleString() : "the limit resets";
  return `Received. Today's deposit limit is reached, so this is credited automatically after ${when}.`;
}

function shieldedAddress(value: string): string {
  return value.trim().replace(/^zcash:/i, "").split("?")[0];
}

function depositText(status: DepositStatus): string {
  if (status.status === "queued") return status.queued ? queuedText(status.queued) : "Received, crediting…";
  if (status.status === "waiting") return "Waiting for the payment.";
  if (status.status === "confirming") return `Confirming ${status.confirming[0]?.confirmations ?? 0}/${status.confirming[0]?.needed ?? 3}.`;
  if (status.status === "expired") return "This address expired. Start another deposit.";
  if (status.status === "credited") return "Credited.";
  return "";
}

export function DepositPanel({ onDone }: { onDone?: () => void }) {
  const { view } = useVault();
  const [amount, setAmount] = useState("0.1");
  const [split, setSplit] = useState<Split | null>(null);
  const [shown, setShown] = useState<Shown[]>([]);
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
      setShown((current) => [...current.filter((row) => row.slot !== created.slot), created]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The deposit could not start.");
    } finally {
      setBusy("");
    }
  }

  useEffect(() => {
    const session = readSession();
    if (!session) return;
    let stop = false;
    const tick = async () => {
      const map = await session.client.pollDeposits();
      if (stop) return;
      setShown((current) => {
        const bySlot = new Map(current.map((row) => [row.slot, row]));
        for (const [slot, status] of map) bySlot.set(slot, { ...status, slot });
        return [...bySlot.values()].sort((a, b) => a.slot - b.slot);
      });
    };
    void tick().catch(() => {});
    const timer = window.setInterval(() => void tick().catch(() => {}), 4000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [view.network]);

  const noted = useRef(new Set<number>());

  useEffect(() => {
    const session = readSession();
    if (!session) return;
    const active = shown.some((row) => row.status === "waiting" || row.status === "confirming" || row.status === "queued");
    void writePending(session.network, { deposit: active });
    for (const row of shown) {
      if (row.status !== "credited" || !row.credited || noted.current.has(row.slot)) continue;
      noted.current.add(row.slot);
      const credited = row.credited;
      const parts: string[] = [];
      if (credited.zec.amount_zats > 0) parts.push(`+${formatZec(credited.zec.amount_zats)} ZEC`);
      if (credited.usd.amount_micro_usd > 0) parts.push(`+${formatCredits(credited.usd.amount_micro_usd, view.microPerCredit)} cr`);
      void rememberActivity(session.network, {
        id: `deposit:${row.slot}`,
        kind: "deposit",
        title: "Deposit",
        detail: parts.join(" · ") || `+${formatZec(credited.zec_zats)} ZEC`,
      });
    }
  }, [shown, view.microPerCredit]);

  const payable = [...shown].reverse().find((row) => row.status === "waiting" || row.status === "confirming") ?? null;

  async function payHere() {
    const session = readSession();
    if (!session || !payable) return;
    setBusy("Paying from this wallet…");
    setError("");
    try {
      const zats = payable.expected_zats ? BigInt(payable.expected_zats) : parseZec(amount);
      const birthday = (await readWalletBirthday(session.network, session.keys)) ?? 0;
      await payFromWallet(session.phrase, view.network, payable.address, zats, birthday);
      setBusy("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The wallet payment did not send.");
      setBusy("");
    }
  }

  const zecAmount = payable?.expected_zats ? formatZec(payable.expected_zats) : amount;
  const uri = payable ? zip321(payable.address, zecAmount) : "";
  const keptZats = estimate ? parseZec(amount) - estimate.zecZats : 0n;
  const open = shown.length > 0;

  return (
    <div className="grid gap-4">
      {!open ? (
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
          {shown.map((status) => {
            const credited = status.credited;
            const settled = status.status === "credited" || status.status === "queued";
            return (
              <div key={status.slot} className="grid gap-2">
                <Notice tone={settled ? "ok" : "warn"}>{depositText(status)}</Notice>
                {status.claim ? <p className="text-[13px] text-muted">A second payment was found. It is credited on its own.</p> : null}
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
              </div>
            );
          })}
          {payable && canPayHere ? (
            <div className="flex flex-wrap gap-2">
              <Button disabled={Boolean(busy)} onClick={() => void payHere()}>{busy || "Pay from this wallet"}</Button>
            </div>
          ) : null}
          {uri && payable ? <QRPay uri={uri} address={shieldedAddress(payable.address)} caption="Send shielded ZEC. No memo." /> : null}
          {error ? <p className="text-[13px] text-danger">{error}</p> : null}
          {onDone && shown.every((row) => row.status === "credited") ? <Button onClick={onDone}>Continue</Button> : null}
        </>
      )}
    </div>
  );
}
