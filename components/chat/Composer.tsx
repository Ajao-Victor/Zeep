"use client";

import { useRef, type ClipboardEvent, type DragEvent, type KeyboardEvent } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { formatCredits } from "@/lib/zeep";
import type { PriceModel, PriceSheet } from "@/lib/zeep/prices";
import type { Attachment } from "@/lib/chat/types";
import { fileKind } from "@/lib/chat/files";
import type { ForgePhase } from "@/lib/fx/forge";
import { Button } from "@/components/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Textarea } from "@/components/ui/Input";
import { MenuContent, MenuRadioItem } from "@/components/ui/Menu";
import { ProofButton } from "@/components/ui/ProofButton";

export function Composer({
  value,
  onChange,
  onSend,
  busy,
  phase,
  modelId,
  onModel,
  prices,
  attachments,
  onAttach,
  onRemove,
  hint,
  longer,
  onLonger,
  longerFrom,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  busy: boolean;
  /** The Forge phase of the paid request (ChatScreen's useForge). */
  phase: ForgePhase;
  modelId: string;
  onModel: (id: string) => void;
  prices: PriceSheet | null;
  attachments: Attachment[];
  onAttach: (files: FileList | File[]) => void;
  onRemove: (id: string) => void;
  hint: string;
  longer: boolean;
  onLonger: (value: boolean) => void;
  longerFrom: string | null;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const model = prices?.models.find((item) => item.id === modelId) ?? prices?.models[0];
  const images = model?.vision !== false;

  function grow() {
    const box = boxRef.current;
    if (!box) return;
    box.style.height = "auto";
    // scrollHeight excludes the border; add it back, since the box is border-box.
    box.style.height = `${Math.min(box.scrollHeight + box.offsetHeight - box.clientHeight, 160)}px`;
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
      <Textarea
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
        aria-label="Message"
        className="max-h-40"
      />
      {hint ? <p className="mt-1 text-[12px] text-warn">{hint}</p> : null}
      <div className="mt-2 flex items-center gap-2">
        <IconButton variant="glass" label="Attach a file" onClick={() => fileRef.current?.click()}>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M6.2 8.8 9.7 5.3a2.2 2.2 0 0 1 3.1 3.1l-4.6 4.6a3.2 3.2 0 0 1-4.5-4.5l4.2-4.2" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </IconButton>
        <input
          ref={fileRef}
          type="file"
          multiple
          className="hidden"
          accept={images ? "image/*,application/pdf,text/*,.md,.csv,.json,.js,.ts,.tsx,.py" : "application/pdf,text/*,.md,.csv,.json,.js,.ts,.tsx,.py"}
          onChange={(event) => {
            if (event.target.files) onAttach(event.target.files);
            event.target.value = "";
          }}
        />
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <Button variant="secondary" size="sm" className="min-w-0 max-w-56 gap-2">
              <span className="min-w-0 truncate">{model?.name ?? "Model"}</span>
              <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" className="shrink-0 text-muted">
                <path d="M2 6.5 5 3.5l3 3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Button>
          </DropdownMenu.Trigger>
          <MenuContent side="top" align="start" className="w-[min(26rem,calc(100vw-2rem))]">
            <DropdownMenu.RadioGroup value={model?.id ?? ""} onValueChange={onModel}>
              {(prices?.models ?? []).map((item) => (
                <ModelRow key={item.id} item={item} perCredit={prices?.micro_usd_per_credit ?? 1_000_000} />
              ))}
            </DropdownMenu.RadioGroup>
            {model?.metered ? (
              <button
                type="button"
                aria-pressed={longer}
                onClick={() => onLonger(!longer)}
                className="mt-1 flex w-full items-center justify-between gap-3 border-t border-line px-3 py-2 text-left text-[14px] text-text"
              >
                <span>Longer answers</span>
                {longerFrom ? <span className="shrink-0 font-mono text-[12px] text-gold">{longerFrom}</span> : null}
              </button>
            ) : null}
          </MenuContent>
        </DropdownMenu.Root>
        <ProofButton size="sm" phase={phase} label="Send" disabled={busy} onClick={onSend} className="ml-auto" />
      </div>
    </div>
  );
}

function ModelRow({ item, perCredit }: { item: PriceModel; perCredit: number }) {
  return (
    <MenuRadioItem value={item.id}>
      <span className="flex items-center justify-between gap-3">
        <span className="min-w-0">
          <span className="block truncate text-[14px]">{item.name}</span>
          <span className="block truncate text-[12px] text-faint">
            {[item.detail, item.vision ? "reads images" : ""].filter(Boolean).join(" · ") || "\u00a0"}
          </span>
        </span>
        <span className="shrink-0 font-mono text-[12px] text-gold">from {formatCredits(item.micro_usd, perCredit)} cr</span>
      </span>
    </MenuRadioItem>
  );
}

export function rejectKind(file: File): string | null {
  const kind = fileKind(file);
  if (!kind) return `${file.name} is not an image, a text file, or a PDF.`;
  return null;
}
