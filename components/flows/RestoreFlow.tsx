"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { config } from "@/lib/config";
import { errorText } from "@/lib/format";
import { formatUsd, formatZec, seedFromPhrase } from "@/lib/zeep";
import { wordCount } from "@/lib/vault/phrase";
import { passkeySupported, registerPasskey } from "@/lib/vault/passkey";
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

  function fillWords(start: number, value: string) {
    const parts = value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    setWords((current) => {
      if (parts.length <= 1) return current.map((item, index) => (index === start ? value.trim().toLowerCase() : item));
      const next = [...current];
      parts.forEach((word, offset) => {
        if (start + offset < next.length) next[start + offset] = word;
      });
      return next;
    });
  }

  function beginPin() {
    try {
      seedFromPhrase(words.join(" "));
    } catch {
      setError("Those words are not a valid recovery phrase.");
      return;
    }
    setError("");
    setConfirming(true);
  }

  async function restore(withPasskey: boolean) {
    if (pin !== again) {
      setError("The two PINs do not match.");
      return;
    }
    setBusy("Finding your notes");
    setError("");
    let prf: Uint8Array | undefined;
    let credentialId: string | undefined;
    if (withPasskey) {
      setBusy("Waiting for fingerprint…");
      try {
        const created = await registerPasskey();
        prf = created.prf;
        credentialId = created.credentialId;
      } catch (cause) {
        setError(errorText(cause));
        setBusy("");
        return;
      }
    }
    try {
      const outcome = await restoreVault(
        { network: view.network, pin, phrase: words.join(" "), prf, credentialId },
        (message) => setBusy(message),
      );
      setPin("");
      setAgain("");
      setWords(Array.from({ length: count }, () => ""));
      setResult(`Restored. ${formatUsd(outcome.usd)} in dollars and ${formatZec(outcome.zec)} ZEC.`);
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy("");
      prf?.fill(0);
    }
  }

  return (
    <Page narrow>
      <PageIntro title="Sign in with 24 words" lede={`Enter the ${count} words, then set a new PIN or fingerprint for this device. The same phrase restores the Zcash wallet, the private balance, and the chats.`} />
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
                onChange={(value) => fillWords(index, value)}
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
              <>
                <Button disabled={Boolean(busy) || again.length !== config.pinLength} onClick={() => void restore(false)}>{busy || "Sign in"}</Button>
                {passkeySupported() ? (
                  <Button variant="secondary" disabled={Boolean(busy) || again.length !== config.pinLength} onClick={() => void restore(true)}>
                    Also use fingerprint
                  </Button>
                ) : null}
              </>
            ) : (
              <Button disabled={pin.length !== config.pinLength || words.some((word) => !word.trim())} onClick={beginPin}>
                Continue
              </Button>
            )}
          </div>
        </Panel>
      )}
    </Page>
  );
}
