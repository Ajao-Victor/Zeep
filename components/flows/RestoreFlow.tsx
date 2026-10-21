"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { config } from "@/lib/config";
import { errorText } from "@/lib/format";
import { formatUsd, formatZec } from "@/lib/zeep";
import { wordCount } from "@/lib/vault/phrase";
import { restoreVault } from "@/lib/vault/vault";
import { Button } from "@/components/Button";
import { Notice, Page, PageIntro, Panel, TextField } from "@/components/Panel";
import { PinPad } from "@/components/PinPad";
import { useVault } from "@/components/Providers";

export function RestoreFlow() {
  const { view } = useVault();
  const router = useRouter();
  const count = wordCount();
  const [words, setWords] = useState<string[]>(() => Array.from({ length: count }, () => ""));
  const [pin, setPin] = useState("");
  const [again, setAgain] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState("");

  async function restore() {
    if (pin !== again) {
      setError("The two PINs do not match.");
      return;
    }
    setBusy("Restoring the balance…");
    setError("");
    try {
      const outcome = await restoreVault({
        network: view.network,
        pin,
        phrase: words.join(" "),
      });
      setPin("");
      setAgain("");
      setWords(Array.from({ length: count }, () => ""));
      setResult(`Restored. ${formatUsd(outcome.usd)} in dollars and ${formatZec(outcome.zec)} ZEC.`);
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy("");
    }
  }

  return (
    <Page narrow>
      <PageIntro title="Restore a balance" lede={`Enter the ${count} words, then set a new PIN. The same phrase restores the Zcash wallet, the private balance, and the chats.`} />
      <div className="mb-4">
        <Notice tone="warn">Lock the old device first. Two devices can spend the same note only until the next refresh, and the second spend is rejected.</Notice>
      </div>
      {result ? (
        <Panel>
          <p className="text-[15px] leading-relaxed">{result}</p>
          <div className="mt-5">
            <Button onClick={() => router.push("/services")}>Continue</Button>
          </div>
        </Panel>
      ) : (
        <Panel>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {words.map((word, index) => (
              <TextField
                key={index}
                label={`${index + 1}`}
                value={word}
                autoComplete="off"
                onChange={(value) => setWords((current) => current.map((item, itemIndex) => (itemIndex === index ? value : item)))}
              />
            ))}
          </div>
          <h2 className="mt-6 text-[17px] font-medium">{confirming ? "Enter the new PIN again" : "New PIN"}</h2>
          <div className="mt-4">
            <PinPad length={config.pinLength} value={confirming ? again : pin} onChange={confirming ? setAgain : setPin} />
          </div>
          {busy ? <p className="mt-3 text-[13px] text-muted">{busy}</p> : null}
          {error ? <p className="mt-3 text-[13px] text-danger">{error}</p> : null}
          <div className="mt-5 flex flex-wrap gap-2">
            {confirming ? (
              <Button disabled={Boolean(busy)} onClick={() => void restore()}>{busy || "Restore"}</Button>
            ) : (
              <Button disabled={pin.length !== config.pinLength || words.some((word) => !word.trim())} onClick={() => setConfirming(true)}>
                Continue
              </Button>
            )}
          </div>
        </Panel>
      )}
    </Page>
  );
}
