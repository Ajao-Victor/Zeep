"use client";

import * as Dialog from "@radix-ui/react-dialog";
import type { ChatPrefs } from "@/lib/chat/types";

export function SettingsDialog({
  open,
  onOpenChange,
  prefs,
  onPrefs,
  onDelete,
  confirm,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefs: ChatPrefs;
  onPrefs: (prefs: ChatPrefs) => void;
  onDelete: () => void;
  confirm: boolean;
  onConfirm: (value: boolean) => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/70" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-surface p-5 outline-none">
          <Dialog.Title className="text-[17px] font-medium">Chat settings</Dialog.Title>
          <Dialog.Description className="mt-1 text-[13px] text-muted">Chats stay encrypted on this device. Sync stores only ciphertext.</Dialog.Description>
          <label className="mt-5 flex items-center justify-between gap-4 text-[14px]">
            Auto-delete chats after 30 days
            <input type="checkbox" checked={prefs.autodelete} onChange={(event) => onPrefs({ ...prefs, autodelete: event.target.checked })} />
          </label>
          <label className="mt-3 flex items-center justify-between gap-4 text-[14px]">
            Sync chats across devices
            <input type="checkbox" checked={prefs.sync} onChange={(event) => onPrefs({ ...prefs, sync: event.target.checked })} />
          </label>
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => (confirm ? onDelete() : onConfirm(true))}
              className="rounded-lg border border-danger px-3 py-2 text-[14px] text-danger hover:bg-line-strong"
            >
              {confirm ? "Confirm delete all" : "Delete all chats"}
            </button>
            <Dialog.Close className="rounded-lg border border-line px-3 py-2 text-[14px] text-muted">Close</Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
