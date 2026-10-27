"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { config } from "@/lib/config";
import { serviceAt } from "@/lib/catalog";
import { errorText } from "@/lib/format";
import { useVaultDoor } from "@/lib/fx/useVaultDoor";
import { createPhrase, quizIndexes } from "@/lib/vault/phrase";
import { passkeySupported, registerPasskey } from "@/lib/vault/passkey";
import { createVault } from "@/lib/vault/vault";
import { Button } from "@/components/Button";
import { DepositPanel } from "@/components/deposit/DepositPanel";
import { Notice, Page, PageIntro, Panel, TextField } from "@/components/Panel";
import { PhraseGrid } from "@/components/PhraseGrid";
import { PinPad } from "@/components/PinPad";
import { VaultDoor } from "@/components/fx/VaultDoor";
import { useVault } from "@/components/Providers";
import { cx } from "@/lib/cx";

const STEPS = ["Phrase", "PIN", "Deposit"] as const;
type Step = (typeof STEPS)[number] | "Welcome";

export function phraseWords(phrase: string): string[] {
  return phrase.trim().split(/\s+/);
}

export function GetFlow() {
  const { view } = useVault();
  const router = useRouter();
  const [step, setStep] = useState<Step>("Welcome");
  // A landing service card opens /get?next=<service>: once the balance exists, go there instead of
  // /services. Only the five service routes are accepted. Read after mount (the page is static).
  const [next, setNext] = useState<ReturnType<typeof serviceAt>>(null);
  useEffect(() => setNext(serviceAt(new URLSearchParams(window.location.search).get("next"))), []);
  const [pin, setPin] = useState("");
  const [again, setAgain] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [quizzing, setQuizzing] = useState(false);
  const [answers, setAnswers] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const door = useVaultDoor("open");
  const indexes = quizIndexes();
  const words = phrase ? phraseWords(phrase) : [];

  useEffect(() => {
    if (step === "Phrase" && !phrase) setPhrase(createPhrase());
  }, [phrase, step]);

  // The vault is saved when the door seals; move on once the seal has played.
  useEffect(() => {
    if (door.phase === "closed") setStep("Deposit");
  }, [door.phase]);

  if (!view.ready) return <Page narrow><p className="text-muted">Checking this device…</p></Page>;
  // Our own createVault unlocks the session mid-ceremony, so this applies only before sealing starts.
  if (view.status === "unlocked" && step !== "Deposit" && door.phase === "open") {
    return (
      <Page narrow>
        <PageIntro title="This network already has a balance." lede="It is unlocked on this device." />
        <div className="flex gap-2">
          <Button href="/services">Open services</Button>
          <Button href="/wallet?action=deposit" variant="secondary">Deposit</Button>
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
      await door.track(() => createVault({ network: view.network, pin, phrase, prf, credentialId }));
      setPhrase("");
      setPin("");
      setAgain("");
      setBusy("Vault sealed.");
    } catch (cause) {
      setError(errorText(cause));
      setBusy("");
    } finally {
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
      <PageIntro kicker={view.network === "testnet" ? "Testnet balance" : "Mainnet balance"} title={step === "Welcome" ? "Zeep" : "Open a balance"} lede={step === "Welcome" ? "Create a new account, or sign in with the 24 words from an account you already have." : "One 24-word phrase holds the Zcash wallet and the private Zeep balance. It never leaves this device unencrypted."} />
      {step === "Welcome" ? (
        <Panel>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => { setPhrase(createPhrase()); setStep("Phrase"); }}>Create a new account</Button>
            <Button href={next ? `/restore?next=${encodeURIComponent(next.href)}` : "/restore"} variant="secondary">Sign in with 24 words</Button>
          </div>
          {next ? <p className="mt-4 text-[13px] text-muted">After this, you&apos;ll go to {next.name}.</p> : null}
        </Panel>
      ) : (
      <>
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
                  secret
                  invalid={Boolean(error) && answers[index]?.trim().toLowerCase() !== words[number - 1]}
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
            {quizzing ? <Button variant="secondary" onClick={() => setQuizzing(false)}>Back</Button> : (
              <Button variant="secondary" onClick={() => { setPhrase(""); setStep("Welcome"); }}>Back</Button>
            )}
          </div>
        </Panel>
      ) : null}

      {step === "PIN" ? (
        <Panel>
          <div className="mb-5 flex justify-center">
            <VaultDoor phase={door.phase} />
          </div>
          <h2 className="text-center text-[17px] font-medium">{confirming ? "Enter the PIN again" : "Choose a 6-digit PIN"}</h2>
          <p className="mt-2 text-center text-[14px] text-muted">Argon2id derives the key in a worker. Five wrong unlocks erase this device's vault.</p>
          <div className="mt-5">
            <PinPad
              length={config.pinLength}
              value={confirming ? again : pin}
              onChange={confirming ? setAgain : setPin}
              status={door.phase === "sealing" ? "busy" : door.phase === "sealed" || door.phase === "closed" ? "ok" : "idle"}
              disabled={Boolean(busy)}
            />
          </div>
          {error ? <p className="mt-3 text-center text-[13px] text-danger">{error}</p> : null}
          <p className="mt-3 min-h-5 text-center text-[13px] text-muted" role="status">{busy}</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
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
            <Button variant="secondary" disabled={Boolean(busy)} onClick={() => (confirming ? setConfirming(false) : setStep("Phrase"))}>Back</Button>
          </div>
        </Panel>
      ) : null}

      {step === "Deposit" ? (
        <Panel>
          <h2 className="text-[17px] font-medium">Deposit any amount</h2>
          <p className="mt-2 text-[14px] text-muted">Whatever arrives is credited, even if it differs from what you type. You can skip this and deposit later.</p>
          <div className="mt-5">
            <DepositPanel onDone={() => router.push(next?.href ?? "/services")} />
          </div>
        </Panel>
      ) : null}
      </>
      )}
    </Page>
  );
}
