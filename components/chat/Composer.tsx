"use client";

import { useRef, type ClipboardEvent, type DragEvent, type KeyboardEvent } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Tooltip from "@radix-ui/react-tooltip";
import { formatCredits, formatZec } from "@/lib/zeep";
import type { PriceModel, PriceSheet } from "@/lib/zeep/prices";
import type { Attachment } from "@/lib/chat/types";
import { fileKind } from "@/lib/chat/files";
import { Button } from "@/components/Button";

export function Composer({
  value,
  onChange,
  onSend,
  busy,
  modelId,
  onModel,
  prices,
  attachments,
  onAttach,
  onRemove,
  hint,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  busy: boolean;
  modelId: string;
  onModel: (id: string) => void;
  prices: PriceSheet | null;
  attachments: Attachment[];
  onAttach: (files: FileList | File[]) => void;
  onRemove: (id: string) => void;
  hint: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const model = prices?.models.find((item) => item.id === modelId) ?? prices?.models[0];
  const perMb = prices ? formatCredits(prices.attachments.micro_usd_per_mb, prices.micro_usd_per_credit) : "…";

  function grow() {
    const box = boxRef.current;
    if (!box) return;
    box.style.height = "auto";
    box.style.height = `${Math.min(box.scrollHeight, 160)}px`;
  }

  function onKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSend();
    }
  }

  function onPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const files = [...event.clipboardData.files];
    if (files.length) {
      event.preventDefault();
      onAttach(files);
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (event.dataTransfer.files.length) onAttach(event.dataTransfer.files);
  }

  return (
    <div
      className="border-t border-line bg-bg px-3 pt-3"
      style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
    >
      {attachments.length ? (
        <ul className="mb-2 flex flex-wrap gap-2">
          {attachments.map((item) => (
            <li key={item.id} className="flex items-center gap-2 rounded-full border border-line bg-surface px-2 py-1 text-[12px] text-muted">
              {item.previewUrl ? <img src={item.previewUrl} alt="" className="h-8 w-8 rounded-full object-cover" /> : null}
              <span className="max-w-[10rem] truncate">{item.name}</span>
              <span className="font-mono">{Math.max(1, Math.round(item.size / 1024))} KB</span>
              <button type="button" onClick={() => onRemove(item.id)} className="text-faint hover:text-text" aria-label={`Remove ${item.name}`}>
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <textarea
        ref={boxRef}
        value={value}
        rows={1}
        onChange={(event) => {
          onChange(event.target.value);
          grow();
        }}
        onKeyDown={onKey}
        onPaste={onPaste}
        placeholder="Message"
        className="max-h-40 w-full resize-none bg-transparent text-[15px] outline-none placeholder:text-faint"
      />
      {hint ? <p className="mt-1 text-[12px] text-warn">{hint}</p> : null}
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          aria-label="Attach a file"
          onClick={() => fileRef.current?.click()}
          className="grid h-9 w-9 place-items-center rounded-lg border border-line text-muted hover:bg-raised"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M6.2 8.8 9.7 5.3a2.2 2.2 0 0 1 3.1 3.1l-4.6 4.6a3.2 3.2 0 0 1-4.5-4.5l4.2-4.2" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          className="hidden"
          accept="image/*,application/pdf,text/*,.md,.csv,.json,.js,.ts,.tsx,.py"
          onChange={(event) => {
            if (event.target.files) onAttach(event.target.files);
            event.target.value = "";
          }}
        />
        <DropdownMenu.Root>
          <DropdownMenu.Trigger className="min-w-0 truncate rounded-lg border border-line px-3 py-2 text-[13px] text-muted hover:bg-raised">
            {model?.name ?? "Model"}
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className="z-50 max-h-80 w-[min(20rem,calc(100vw-2rem))] overflow-y-auto rounded-lg border border-line bg-surface p-1" side="top" align="start">
              {(prices?.models ?? []).map((item) => (
                <ModelRow key={item.id} item={item} perCredit={prices?.micro_usd_per_credit ?? 1_000_000} zecUsd={prices?.zec_usd ?? 0} onPick={() => onModel(item.id)} />
              ))}
              <p className="px-3 py-2 text-[12px] leading-relaxed text-faint">Attachments over 64 KB add {perMb} cr per MB.</p>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
        <Button size="sm" disabled={busy} onClick={onSend} className="ml-auto">
          {busy ? "Proving…" : "Send"}
        </Button>
      </div>
    </div>
  );
}

function ModelRow({ item, perCredit, zecUsd, onPick }: { item: PriceModel; perCredit: number; zecUsd: number; onPick: () => void }) {
  const zats = !zecUsd || item.micro_usd <= 0 ? 0n : BigInt(Math.floor((item.micro_usd / 1e6 / zecUsd) * 1e8));
  return (
    <DropdownMenu.Item onSelect={onPick} className="cursor-pointer rounded-md px-3 py-2 outline-none data-[highlighted]:bg-raised">
      <span className="flex items-center justify-between gap-3">
        <span className="min-w-0">
          <span className="block truncate text-[14px]">{item.name}</span>
          {item.detail ? <span className="block truncate text-[12px] text-faint">{item.detail}</span> : null}
          {item.vision ? <span className="mt-1 inline-block rounded-full border border-line px-2 py-0.5 text-[11px] text-muted">reads images</span> : null}
        </span>
        <Tooltip.Provider delayDuration={200}>
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <span className="shrink-0 font-mono text-[12px] text-gold">{formatCredits(item.micro_usd, perCredit)} cr</span>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content className="z-50 rounded-lg border border-line bg-bg px-2 py-1 text-[12px]">{formatZec(zats)} ZEC</Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>
      </span>
    </DropdownMenu.Item>
  );
}

export function rejectKind(file: File): string | null {
  const kind = fileKind(file);
  if (!kind) return `${file.name} is not an image, a text file, or a PDF.`;
  return null;
}
