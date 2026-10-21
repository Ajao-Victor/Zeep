"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { config } from "@/lib/config";
import { errorText } from "@/lib/format";
import { passkeySupported, unlockPasskey } from "@/lib/vault/passkey";
import { PinError, readMeta, unlockWithPasskey, unlockWithPin } from "@/lib/vault/vault";
import { Button } from "@/components/Button";
import { Notice, Page, PageIntro, Panel } from "@/components/Panel";
import { PinPad } from "@/components/PinPad";
import { useVault } from "@/components/Providers";

function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/services";
  return value;
}

export function UnlockFlow() {
  const { view } = useVault();
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [hasPasskey, setHasPasskey] = useState(false);

  useEffect(() => {
    if (!view.ready) return;
    if (view.status === "unlocked") router.replace(next);
    if (view.status === "empty") return;
    void readMeta(view.network).then((meta) => setHasPasskey(Boolean(meta?.credentialId && meta.prfWrap)));
  }, [view.ready, view.status, view.network, router, next]);

  async function unlockPin() {
    setBusy("Deriving key…");
    setError("");
    try {
      await unlockWithPin(view.network, pin);
      setPin("");
      router.replace(next);
    } catch (cause) {
      setError(errorText(cause));
      if (cause instanceof PinError && cause.wiped) router.push("/restore");
    } finally {
      setBusy("");
    }
  }

  async function unlockFinger() {
    setBusy("Waiting for fingerprint…");
    setError("");
    try {
      const meta = await readMeta(view.network);
      if (!meta?.credentialId) throw new Error("Fingerprint unlock is not set.");
      const prf = await unlockPasskey(meta.credentialId);
      await unlockWithPasskey(view.network, prf);
      router.replace(next);
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy("");
    }
  }

  if (!view.ready) return <Page narrow><p className="text-muted">Checking this device…</p></Page>;

  if (view.status === "empty") {
    return (
      <Page narrow>
        <PageIntro title="No pass on this device" lede={`Nothing is stored for ${view.network}.`} />
        <Button href="/get">Open a balance</Button>
      </Page>
    );
  }

  if (view.status === "wiped") {
    return (
      <Page narrow>
        <PageIntro title="Vault erased" />
        <Notice tone="danger">Five wrong PINs erased the vault on this device. Restore it with the 24 words.</Notice>
        <div className="mt-4">
          <Button href="/restore">Restore</Button>
        </div>
      </Page>
    );
  }

  return (
    <Page narrow>
      <PageIntro kicker={view.network} title="Unlock" lede="The key is derived on this device. The PIN is not sent anywhere." />
      <Panel>
        {hasPasskey && passkeySupported() ? (
          <Button className="mb-5 w-full" disabled={Boolean(busy)} onClick={() => void unlockFinger()}>
            Unlock with fingerprint
          </Button>
        ) : null}
        <PinPad value={pin} onChange={setPin} length={config.pinLength} />
        {busy ? <p className="mt-4 text-[13px] text-muted">{busy}</p> : null}
        {error ? <p className="mt-4 text-[13px] text-danger">{error}</p> : null}
        <div className="mt-5 flex flex-wrap gap-2">
          <Button disabled={Boolean(busy) || pin.length !== config.pinLength} onClick={() => void unlockPin()}>
            Unlock
          </Button>
          <Button href="/restore" variant="secondary">Restore with words</Button>
        </div>
      </Panel>
    </Page>
  );
}
