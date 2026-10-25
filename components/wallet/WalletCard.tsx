"use client";

import { useEffect, useState } from "react";
import { formatZec } from "@/lib/zeep";
import { readSession } from "@/lib/vault/session";
import { readWalletBirthday, rememberBirthday } from "@/lib/zcash/birthday";
import { walletSummary, type WalletSummary } from "@/lib/zcash/wallet";
import { CopyField } from "@/components/CopyField";
import { useVault } from "@/components/Providers";

export function WalletCard() {
  const { view } = useVault();
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [note, setNote] = useState("");
  const [showTransparent, setShowTransparent] = useState(false);

  useEffect(() => {
    const session = readSession();
    if (!session) return;
    let stop = false;
    void (async () => {
      const birthday = (await readWalletBirthday(session.network, session.keys)) ?? 0;
      if (stop) return;
      try {
        const summary = await walletSummary(session.phrase, view.network, birthday);
        if (stop) return;
        setWallet(summary);
        if (summary.height > 0) void rememberBirthday(session.network, session.keys, summary.height);
      } catch (cause) {
        if (!stop) setNote(cause instanceof Error ? cause.message : "The in-app wallet is unavailable.");
      }
    })();
    return () => {
      stop = true;
    };
  }, [view.network]);

  return (
    <div className="grid gap-3">
      <div>
        <p className="text-[13px] text-faint">In-app wallet</p>
        <p className="mt-1 font-mono text-[20px] text-text">{wallet ? `${formatZec(wallet.shieldedZats)} ZEC` : "…"}</p>
        {wallet?.shielding ? (
          <p className="mt-1 text-[13px] text-warn">Shielding {formatZec(wallet.transparentZats)} ZEC…</p>
        ) : null}
      </div>
      {wallet?.unified ? <CopyField label="Unified address" value={wallet.unified} /> : null}
      {wallet?.transparentAddress ? (
        <div>
          <button type="button" className="text-[13px] text-muted underline-offset-2 hover:underline" onClick={() => setShowTransparent((open) => !open)}>
            My exchange can&apos;t send to this address
          </button>
          {showTransparent ? (
            <div className="mt-2 grid gap-2">
              <CopyField label="Transparent address" value={wallet.transparentAddress} />
              <p className="text-[13px] text-faint">ZEC sent here is shielded automatically.</p>
            </div>
          ) : null}
        </div>
      ) : null}
      {note ? <p className="text-[13px] text-faint">{note}</p> : null}
    </div>
  );
}
