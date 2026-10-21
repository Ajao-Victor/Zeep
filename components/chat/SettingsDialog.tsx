"use client";

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { fileCount } from "@/lib/chat/blobs";
import type { ChatPrefs } from "@/lib/chat/types";
import { readSession } from "@/lib/vault/session";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function SettingsDialog({
  open,
  onOpenChange,
  prefs,
  onPrefs,
  onDelete,
  confirm,
  onConfirm,
  onDeleteFiles,
  onDeleteChat,
  hasChat,
  onSignOut,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefs: ChatPrefs;
  onPrefs: (prefs: ChatPrefs) => void;
  onDelete: () => void;
  confirm: boolean;
  onConfirm: (value: boolean) => void;
  onDeleteFiles: () => void;
  onDeleteChat: () => void;
  hasChat: boolean;
  onSignOut: () => void;
}) {
  const [used, setUsed] = useState<number | null>(null);
  const [files, setFiles] = useState(0);

  useEffect(() => {
    if (!open) return;
    void navigator.storage?.estimate().then((estimate) => setUsed(estimate.usage ?? 0));
    const session = readSession();
    if (session) void fileCount(session.network).then(setFiles);
  }, [open]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/70" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[min(40rem,calc(100dvh-2rem))] w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-line bg-surface p-5 outline-none">
          <Dialog.Title className="text-[17px] font-medium">Settings</Dialog.Title>
          <Dialog.Description className="mt-1 text-[13px] text-muted">Chats stay encrypted on this device. Sync stores only ciphertext. Images and files stay on this device.</Dialog.Description>
          <label className="mt-5 flex items-center justify-between gap-4 text-[14px]">
            Auto-delete chats after 30 days
            <input type="checkbox" checked={prefs.autodelete} onChange={(event) => onPrefs({ ...prefs, autodelete: event.target.checked })} />
          </label>
          <label className="mt-3 flex items-center justify-between gap-4 text-[14px]">
            Sync chats across devices
            <input type="checkbox" checked={prefs.sync} onChange={(event) => onPrefs({ ...prefs, sync: event.target.checked })} />
          </label>
          <p className="mt-4 text-[13px] text-faint">
            Storage used: {used == null ? "…" : formatBytes(used)}. Files on this device: {files}.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => (confirm ? onDelete() : onConfirm(true))}
              className="rounded-lg border border-danger px-3 py-2 text-[14px] text-danger hover:bg-line-strong"
            >
              {confirm ? "Confirm delete all" : "Delete all chats"}
            </button>
            <button type="button" onClick={onDeleteFiles} className="rounded-lg border border-line px-3 py-2 text-[14px] text-muted hover:bg-raised">
              Delete all files
            </button>
            {hasChat ? (
              <button type="button" onClick={onDeleteChat} className="rounded-lg border border-line px-3 py-2 text-[14px] text-muted hover:bg-raised">
                Delete this chat
              </button>
            ) : null}
          </div>
          <div className="mt-6 border-t border-line pt-4">
            <p className="text-[13px] text-faint">Account</p>
            <button type="button" onClick={onSignOut} className="mt-2 rounded-lg border border-line px-3 py-2 text-[14px] text-text hover:bg-raised">
              Sign out
            </button>
          </div>
          <Dialog.Close className="mt-4 rounded-lg border border-line px-3 py-2 text-[14px] text-muted">Close</Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
