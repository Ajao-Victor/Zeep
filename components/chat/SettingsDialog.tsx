"use client";

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { fileCount } from "@/lib/chat/blobs";
import type { ChatPrefs } from "@/lib/chat/types";
import { formatUsd } from "@/lib/zeep";
import { readSession } from "@/lib/vault/session";
import { Button } from "@/components/Button";
import { Input } from "@/components/ui/Input";

function trimDollars(micro: bigint): string {
  const whole = micro / 1_000_000n;
  const frac = (micro % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole.toString();
}

function dollarsToMicro(input: string): bigint | null {
  const value = input.trim();
  if (!/^\d+(\.\d{1,6})?$/.test(value)) return null;
  const [whole, frac = ""] = value.split(".");
  return BigInt(whole) * 1_000_000n + BigInt((frac + "000000").slice(0, 6));
}

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
  const [limitUsd, setLimitUsd] = useState("5");
  const [noLimit, setNoLimit] = useState(false);
  const [spent, setSpent] = useState("");
  const [limitError, setLimitError] = useState("");

  function showSpending() {
    const session = readSession();
    if (!session) return;
    const spending = session.client.dailySpending();
    const unlimited = spending.limit === 0n;
    setNoLimit(unlimited);
    if (!unlimited) setLimitUsd(trimDollars(spending.limit));
    setSpent(unlimited ? `Spent today: ${formatUsd(spending.spent)}` : `Spent today: ${formatUsd(spending.spent)} of ${formatUsd(spending.limit)}`);
  }

  useEffect(() => {
    if (!open) return;
    void navigator.storage?.estimate().then((estimate) => setUsed(estimate.usage ?? 0));
    const session = readSession();
    if (session) void fileCount(session.network).then(setFiles);
    showSpending();
  }, [open]);

  async function applyLimit(micro: bigint) {
    const session = readSession();
    if (!session) return;
    await session.client.setDailyLimit(micro);
    showSpending();
  }

  async function commitLimit() {
    if (noLimit) return;
    const micro = dollarsToMicro(limitUsd);
    if (micro === null) {
      setLimitError("Enter an amount in dollars.");
      return;
    }
    setLimitError("");
    if (micro === 0n) {
      setNoLimit(true);
      await applyLimit(0n);
      return;
    }
    await applyLimit(micro);
  }

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
          <div className="mt-5 border-t border-line pt-4">
            <label className="block text-[14px]" htmlFor="daily-limit">Daily spending limit</label>
            <Input
              id="daily-limit"
              className="mt-2"
              inputMode="decimal"
              autoComplete="off"
              placeholder="5"
              aria-describedby="daily-spent"
              disabled={noLimit}
              invalid={Boolean(limitError)}
              value={noLimit ? "" : limitUsd}
              onChange={(event) => {
                setLimitUsd(event.target.value);
                setLimitError("");
              }}
              onBlur={() => void commitLimit()}
            />
            <label className="mt-3 flex items-center justify-between gap-4 text-[14px]">
              No limit
              <input
                type="checkbox"
                checked={noLimit}
                onChange={(event) => {
                  const next = event.target.checked;
                  setNoLimit(next);
                  setLimitError("");
                  if (next) {
                    void applyLimit(0n);
                    return;
                  }
                  const micro = dollarsToMicro(limitUsd);
                  if (micro && micro > 0n) void applyLimit(micro);
                }}
              />
            </label>
            <p id="daily-spent" className="mt-2 text-[13px] text-faint">{spent || "Spent today: …"}</p>
            {limitError ? <p className="mt-1 text-[13px] text-warn">{limitError}</p> : null}
          </div>
          <p className="mt-4 text-[13px] text-faint">
            Storage used: {used == null ? "…" : formatBytes(used)}. Files on this device: {files}.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="danger" size="sm" onClick={() => (confirm ? onDelete() : onConfirm(true))}>
              {confirm ? "Confirm delete all" : "Delete all chats"}
            </Button>
            <Button variant="secondary" size="sm" onClick={onDeleteFiles}>
              Delete all files
            </Button>
            {hasChat ? (
              <Button variant="secondary" size="sm" onClick={onDeleteChat}>
                Delete this chat
              </Button>
            ) : null}
          </div>
          <div className="mt-6 border-t border-line pt-4">
            <p className="text-[13px] text-faint">Account</p>
            <Button variant="secondary" size="sm" className="mt-2" onClick={onSignOut}>
              Sign out
            </Button>
          </div>
          <Dialog.Close asChild>
            <Button variant="ghost" size="sm" className="mt-4">Close</Button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
