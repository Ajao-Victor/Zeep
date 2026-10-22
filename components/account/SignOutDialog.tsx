"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { readPending, type DevicePending } from "@/lib/account/pending";
import { downloadAllFiles, fileCount } from "@/lib/chat/blobs";
import { readChatPrefs } from "@/lib/chat/store";
import { readSession } from "@/lib/vault/session";
import { signOut } from "@/lib/vault/vault";
import { PhraseGrid } from "@/components/PhraseGrid";
import { Reauth } from "@/components/flows/Reauth";
import { useVault } from "@/components/Providers";
import { Button } from "@/components/Button";

export function SignOutDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { view } = useVault();
  const router = useRouter();
  const [sync, setSync] = useState(true);
  const [files, setFiles] = useState(0);
  const [pending, setPending] = useState<DevicePending>({ deposit: false, withdrawal: false });
  const [saved, setSaved] = useState(false);
  const [showPhrase, setShowPhrase] = useState(false);
  const [phrase, setPhrase] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setSaved(false);
      setShowPhrase(false);
      setPhrase(null);
      return;
    }
    const session = readSession();
    if (!session) return;
    void readChatPrefs(session.network).then((prefs) => setSync(prefs.sync));
    void fileCount(session.network).then(setFiles);
    void readPending(session.network).then(setPending);
  }, [open]);

  async function confirm() {
    const session = readSession();
    if (!session) return;
    setBusy(true);
    try {
      await signOut(session.network);
      onOpenChange(false);
      router.push("/get");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[min(40rem,calc(100dvh-2rem))] w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-line bg-surface p-5 outline-none">
          <Dialog.Title className="text-[17px] font-medium">Have you saved your 24-word recovery phrase?</Dialog.Title>
          <Dialog.Description className="mt-2 text-[14px] leading-relaxed text-muted">
            Signing out removes this account from this device. The only way back in is your 24 words. Zeep can&apos;t recover them for you, and without them your balance and wallet are lost for good.
          </Dialog.Description>
          {!sync ? (
            <p className="mt-3 text-[14px] leading-relaxed text-muted">
              Your chats are stored only on this device and will be deleted. Turn on &quot;Sync chats across devices&quot; first to keep them.
            </p>
          ) : null}
          {files > 0 ? (
            <div className="mt-3 text-[14px] leading-relaxed text-muted">
              <p>Your images and files ({files}) are stored only on this device and will be deleted. Download any you want to keep.</p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-2"
                onClick={() => {
                  const session = readSession();
                  if (session) void downloadAllFiles(session.network, session.keys.vaultKey);
                }}
              >
                Download all
              </Button>
            </div>
          ) : null}
          {pending.deposit || pending.withdrawal ? (
            <p className="mt-3 text-[14px] leading-relaxed text-muted">You have a payment in progress. It will finish, and you&apos;ll see it after signing back in.</p>
          ) : null}
          <div className="mt-4">
            {phrase ? (
              <PhraseGrid words={phrase} />
            ) : showPhrase ? (
              <Reauth
                onCancel={() => setShowPhrase(false)}
                onSuccess={() => {
                  const session = readSession();
                  setPhrase(session ? session.phrase.split(/\s+/) : null);
                  setShowPhrase(false);
                }}
              />
            ) : (
              <button type="button" className="text-[14px] text-gold hover:underline" onClick={() => setShowPhrase(true)}>
                Show my phrase
              </button>
            )}
          </div>
          <label className="mt-4 flex items-start gap-2 text-[14px] text-text">
            <input type="checkbox" className="mt-1" checked={saved} onChange={(event) => setSaved(event.target.checked)} />
            <span>I&apos;ve written down my 24 words.</span>
          </label>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="danger" size="sm" disabled={!saved || busy || view.status !== "unlocked"} onClick={() => void confirm()}>
              {busy ? "Signing out…" : "Sign out"}
            </Button>
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm">Cancel</Button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
