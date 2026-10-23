"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { config } from "@/lib/config";
import { errorText } from "@/lib/format";
import { useVaultDoor } from "@/lib/fx/useVaultDoor";
import { passkeySupported, unlockPasskey } from "@/lib/vault/passkey";
import { PinError, readMeta, unlockWithPasskey, unlockWithPin } from "@/lib/vault/vault";
import { Button } from "@/components/Button";
import { Notice, Page, PageIntro, Panel } from "@/components/Panel";
import { PinPad } from "@/components/PinPad";
import { VaultDoor } from "@/components/fx/VaultDoor";
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
  const [wrong, setWrong] = useState(false);
  const door = useVaultDoor("closed");
  // Set while this page's own unlock plays the door open, so the redirect waits for the ceremony.
  const unlocking = useRef(false);
  const { signal } = door;

  useEffect(() => {
    if (!view.ready) return;
    if (view.status === "unlocked" && !unlocking.current) router.replace(next);
    if (view.status === "empty") return;
    void readMeta(view.network).then((meta) => {
      setHasPasskey(Boolean(meta?.credentialId && meta.prfWrap));
      if (meta) signal({ type: "warn", attemptsLeft: config.pinMaxAttempts - meta.failedAttempts });
    });
  }, [view.ready, view.status, view.network, router, next, signal]);

  // The session is already open when the door starts opening; only the route change waits for it.
  useEffect(() => {
    if (door.phase === "unsealed") router.replace(next);
  }, [door.phase, router, next]);

  async function unlockPin() {
    setBusy("Deriving key…");
    setError("");
    setWrong(false);
    unlocking.current = true;
    try {
      await door.track(() => unlockWithPin(view.network, pin));
      setBusy("Unlocked.");
    } catch (cause) {
      unlocking.current = false;
      setError(errorText(cause));
      setWrong(cause instanceof PinError);
      setBusy("");
      if (cause instanceof PinError && cause.wiped) router.push("/restore");
    } finally {
      setPin("");
    }
  }

  async function unlockFinger() {
    setBusy("Waiting for fingerprint…");
    setError("");
    setWrong(false);
    try {
      const meta = await readMeta(view.network);
      if (!meta?.credentialId) throw new Error("Fingerprint unlock is not set.");
      const prf = await unlockPasskey(meta.credentialId);
      unlocking.current = true;
      await door.track(() => unlockWithPasskey(view.network, prf));
      setBusy("Unlocked.");
    } catch (cause) {
      unlocking.current = false;
      setError(errorText(cause));
      setBusy("");
    }
  }

  const pinStatus =
    door.phase === "opening" || door.phase === "unsealed"
      ? "ok"
      : busy === "Deriving key…"
        ? "busy"
        : wrong && !pin
          ? "error"
          : "idle";

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
        <div className="mb-6 flex justify-center">
          <VaultDoor phase={door.phase} warn={door.warn} />
        </div>
        {hasPasskey && passkeySupported() ? (
          <Button className="mb-5 w-full" disabled={Boolean(busy)} onClick={() => void unlockFinger()}>
            Unlock with fingerprint
          </Button>
        ) : null}
        <div className="mx-auto w-fit">
          <PinPad
            value={pin}
            onChange={(value) => {
              setPin(value);
              setWrong(false);
            }}
            length={config.pinLength}
            status={pinStatus}
            disabled={Boolean(busy)}
          />
        </div>
        <p className="mt-4 min-h-5 text-center text-[13px]" role="status">
          {error ? <span className="text-danger">{error}</span> : <span className="text-muted">{busy}</span>}
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button disabled={Boolean(busy) || pin.length !== config.pinLength} onClick={() => void unlockPin()}>
            Unlock
          </Button>
          <Button href="/restore" variant="secondary">Restore with words</Button>
        </div>
      </Panel>
    </Page>
  );
}
