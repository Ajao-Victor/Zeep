"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PinPad } from "@/components/PinPad";
import { Button } from "@/components/Button";
import { config } from "@/lib/config";
import { errorText } from "@/lib/format";
import { passkeySupported, unlockPasskey } from "@/lib/vault/passkey";
import { PinError, verifyPin, verifyPrf } from "@/lib/vault/vault";
import { useVault } from "@/components/Providers";

export function Reauth({
  onSuccess,
  onCancel,
}: {
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const { view } = useVault();
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(kind: "pin" | "passkey") {
    setBusy(true);
    setError("");
    try {
      if (kind === "passkey") {
        const metaId = view.hasPasskey;
        if (!metaId) throw new Error("Fingerprint unlock is not set.");
        const { readMeta } = await import("@/lib/vault/vault");
        const meta = await readMeta(view.network);
        if (!meta?.credentialId) throw new Error("Fingerprint unlock is not set.");
        const prf = await unlockPasskey(meta.credentialId);
        await verifyPrf(prf);
      } else {
        await verifyPin(pin);
      }
      setPin("");
      onSuccess();
    } catch (cause) {
      setError(errorText(cause));
      if (cause instanceof PinError && cause.wiped) router.push("/restore");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {view.hasPasskey && passkeySupported() ? (
        <Button className="mb-4 w-full" disabled={busy} onClick={() => void submit("passkey")}>
          Use fingerprint
        </Button>
      ) : null}
      <PinPad value={pin} onChange={setPin} length={config.pinLength} />
      {error ? <p className="mt-3 text-[13px] text-danger">{error}</p> : null}
      <div className="mt-5 flex gap-2">
        <Button disabled={busy || pin.length !== config.pinLength} onClick={() => void submit("pin")}>
          {busy ? "Checking…" : "Confirm"}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
