"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { config } from "@/lib/config";
import { errorText } from "@/lib/format";
import { createPhrase, quizIndexes } from "@/lib/vault/phrase";
import { passkeySupported, registerPasskey } from "@/lib/vault/passkey";
import { createVault } from "@/lib/vault/vault";
import { Button } from "@/components/Button";
import { DepositPanel } from "@/components/deposit/DepositPanel";
import { Notice, Page, PageIntro, Panel, TextField } from "@/components/Panel";
import { PhraseGrid } from "@/components/PhraseGrid";
import { PinPad } from "@/components/PinPad";
import { useVault } from "@/components/Providers";
import { cx } from "@/lib/cx";

const STEPS = ["Phrase", "PIN", "Deposit"] as const;
type Step = (typeof STEPS)[number];

export function phraseWords(phrase: string): string[] {
  return phrase.trim().split(/\s+/);
}

export function GetFlow() {
  const { view } = useVault();
  const router = useRouter();
  const [step, setStep] = useState<Step>("Phrase");
  const [pin, setPin] = useState("");
  const [again, setAgain] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [quizzing, setQuizzing] = useState(false);
  const [answers, setAnswers] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const indexes = quizIndexes();
  const words = phrase ? phraseWords(phrase) : [];

  useEffect(() => {
    if (!phrase) setPhrase(createPhrase());
  }, [phrase]);

  if (!view.ready) return <Page narrow><p className="text-muted">Checking this device…</p></Page>;
  if (view.status === "unlocked" && step !== "Deposit") {
    return (
      <Page narrow>
        <PageIntro title="This network already has a balance." lede="It is unlocked on this device." />
        <div className="flex gap-2">
          <Button href="/services">Open services</Button>
          <Button href="/deposit" variant="secondary">Deposit</Button>
        </div>
      </Page>
    );
  }
  if (view.status === "locked") {
    return (
      <Page narrow>
        <PageIntro title="This network already has a balance." lede="Unlock it, or restore the 24 words on a new device." />
        <div className="flex gap-2">
          <Button href="/unlock">Unlock</Button>
          <Button href="/restore" variant="secondary">Restore</Button>
        </div>
      </Page>
    );
  }

  async function continuePin(withPasskey: boolean) {
    setError("");
    if (pin !== again) {
      setError("The two PINs do not match.");
      return;
    }
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
    setBusy("Saving the vault…");
    try {
      await createVault({ network: view.network, pin, phrase, prf, credentialId });
      setPhrase("");
      setPin("");
      setAgain("");
      setStep("Deposit");
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy("");
      prf?.fill(0);
    }
  }

  function finishPhrase() {
    const ok = indexes.every((number, index) => answers[index]?.trim().toLowerCase() === words[number - 1]);
    if (!ok) {
      setError("Those words do not match. Check 3, 12 and 21.");
      return;
    }
    setError("");
    setStep("PIN");
  }

  return (
    <Page narrow>
      {view.status === "wiped" ? (
        <div className="mb-4">
          <Notice tone="danger">The vault on this device was erased. You can restore the 24 words, or create a new balance.</Notice>
        </div>
      ) : null}
      <PageIntro kicker={view.network === "testnet" ? "Testnet balance" : "Mainnet balance"} title="Open a balance" lede="One 24-word phrase holds the Zcash wallet and the private Zeep balance. It never leaves this device unencrypted." />
      <ol className="mb-6 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-faint">
        {STEPS.map((item) => (
          <li key={item} className={cx("font-mono", item === step && "text-gold")}>{item}</li>
        ))}
      </ol>

      {step === "Phrase" ? (
        <Panel>
          <h2 className="text-[17px] font-medium">{quizzing ? "Confirm three words" : "Write down the recovery phrase"}</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-muted">These 24 words restore the wallet, the balance, and the chats. They are stored on this device only, encrypted under the PIN.</p>
          {!quizzing && words.length ? <div className="mt-5"><PhraseGrid words={words} /></div> : null}
          {quizzing ? (
            <div className="mt-5 grid gap-3">
              {indexes.map((number, index) => (
                <TextField
                  key={number}
                  label={`Word ${number}`}
                  value={answers[index] ?? ""}
                  onChange={(value) => setAnswers((current) => {
                    const next = indexes.map((_, item) => current[item] ?? "");
                    next[index] = value;
                    return next;
                  })}
                />
              ))}
            </div>
          ) : null}
          {error ? <p className="mt-3 text-[13px] text-danger">{error}</p> : null}
          <div className="mt-5 flex flex-wrap gap-2">
            {quizzing ? (
              <Button onClick={finishPhrase}>Continue</Button>
            ) : (
              <Button onClick={() => { setQuizzing(true); setError(""); setAnswers(indexes.map(() => "")); }}>I wrote these down</Button>
            )}
            {quizzing ? <Button variant="secondary" onClick={() => setQuizzing(false)}>Back</Button> : null}
          </div>
        </Panel>
      ) : null}

      {step === "PIN" ? (
        <Panel>
          <h2 className="text-[17px] font-medium">{confirming ? "Enter the PIN again" : "Choose a 6-digit PIN"}</h2>
          <p className="mt-2 text-[14px] text-muted">Argon2id derives the key in a worker. Five wrong unlocks erase this device's vault.</p>
          <div className="mt-5">
            <PinPad length={config.pinLength} value={confirming ? again : pin} onChange={confirming ? setAgain : setPin} />
          </div>
          {error ? <p className="mt-3 text-[13px] text-danger">{error}</p> : null}
          {busy ? <p className="mt-3 text-[13px] text-muted">{busy}</p> : null}
          <div className="mt-5 flex flex-wrap gap-2">
            {confirming ? (
              <>
                <Button disabled={Boolean(busy) || again.length !== config.pinLength} onClick={() => void continuePin(false)}>Continue</Button>
                {passkeySupported() ? (
                  <Button variant="secondary" disabled={Boolean(busy) || again.length !== config.pinLength} onClick={() => void continuePin(true)}>
                    Also use fingerprint
                  </Button>
                ) : null}
              </>
            ) : (
              <Button disabled={pin.length !== config.pinLength} onClick={() => { setConfirming(true); setError(""); }}>Continue</Button>
            )}
            <Button variant="secondary" onClick={() => (confirming ? setConfirming(false) : setStep("Phrase"))}>Back</Button>
          </div>
        </Panel>
      ) : null}

      {step === "Deposit" ? (
        <Panel>
          <h2 className="text-[17px] font-medium">Deposit any amount</h2>
          <p className="mt-2 text-[14px] text-muted">Whatever arrives is credited, even if it differs from what you type. You can skip this and deposit later.</p>
          <div className="mt-5">
            <DepositPanel onDone={() => router.push("/services")} />
          </div>
        </Panel>
      ) : null}
    </Page>
  );
}
