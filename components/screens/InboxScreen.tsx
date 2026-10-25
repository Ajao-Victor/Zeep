"use client";

import { useCallback, useEffect, useState } from "react";
import { rememberSpend } from "@/lib/account/activity";
import { apiBase } from "@/lib/config";
import { cx } from "@/lib/cx";
import { isFundsError, readPaid } from "@/lib/zeep/pay";
import { copyText } from "@/lib/vault/clipboard";
import { readSession } from "@/lib/vault/session";
import { setInbox } from "@/lib/vault/vault";
import { Button } from "@/components/Button";
import { useVault } from "@/components/Providers";
import { ProofButton } from "@/components/ui/ProofButton";
import { useForge } from "@/lib/fx/useForge";

type Mail = {
  id: string;
  from: string;
  subject: string;
  preview: string;
  body: string;
  at: string | null;
};

function textOf(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(textOf).filter(Boolean).join(", ");
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return textOf(record.email ?? record.address ?? record.name ?? record.text);
  }
  return "";
}

function plain(value: string): string {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function asMail(raw: unknown, index: number): Mail | null {
  if (typeof raw === "string") {
    const body = plain(raw);
    return body ? { id: String(index), from: "Unknown", subject: body.slice(0, 80), preview: body, body, at: null } : null;
  }
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const from = textOf(item.from ?? item.sender ?? item.from_address) || "Unknown";
  const subject = textOf(item.subject) || textOf(item.memo) || "(no subject)";
  const body = plain(textOf(item.text ?? item.body ?? item.html ?? item.memo ?? item.snippet ?? item.preview));
  const preview = plain(textOf(item.preview ?? item.snippet)) || body.replace(/\s+/g, " ").slice(0, 140);
  const at = textOf(item.timestamp ?? item.created_at ?? item.received_at ?? item.date ?? item.at) || null;
  const id = textOf(item.message_id ?? item.id) || `${at ?? "mail"}-${index}`;
  if (!body && subject === "(no subject)" && from === "Unknown") return null;
  return { id, from, subject, preview, body, at };
}

function rowsOf(value: unknown): Mail[] {
  const list = Array.isArray(value)
    ? value
    : value && typeof value === "object" && Array.isArray((value as { messages?: unknown }).messages)
      ? (value as { messages: unknown[] }).messages
      : value && typeof value === "object" && Array.isArray((value as { data?: unknown }).data)
        ? (value as { data: unknown[] }).data
        : [];
  return list.flatMap((item, index) => {
    const mail = asMail(item, index);
    return mail ? [mail] : [];
  });
}

function when(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function fullWhen(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function InboxScreen() {
  const { view } = useVault();
  const [messages, setMessages] = useState<Mail[]>([]);
  const [expires, setExpires] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [funds, setFunds] = useState(false);
  const [copied, setCopied] = useState(false);
  const forge = useForge();
  const price = view.prices?.routes.inbox.micro_usd;
  const selected = messages.find((mail) => mail.id === selectedId) ?? null;

  async function create() {
    const session = readSession();
    if (!session || price === undefined) return;
    setBusy("Opening…");
    setError("");
    setFunds(false);
    try {
      const response = await forge.track(() => session.client.pay("POST", "/v1/inbox", "", BigInt(price)));
      const body = await readPaid<{ inbox_id: string; address: string }>(response);
      await setInbox(body.inbox_id, body.address);
      void rememberSpend(session.network, "/v1/inbox", BigInt(price));
    } catch (cause) {
      setFunds(isFundsError(cause));
      setError(cause instanceof Error ? cause.message : "The inbox did not open.");
    } finally {
      setBusy("");
    }
  }

  const refresh = useCallback(async () => {
    if (!view.inboxId) return;
    setBusy("Reading…");
    setError("");
    try {
      const response = await fetch(`${apiBase(view.network)}/v1/inbox/${view.inboxId}/messages`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = (await response.json()) as { messages?: unknown; expires_at?: unknown };
      setExpires(typeof body.expires_at === "string" ? body.expires_at : null);
      const next = rowsOf(body.messages);
      setMessages(next);
      setSelectedId((current) => (current && next.some((mail) => mail.id === current) ? current : null));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Messages did not load.");
    } finally {
      setBusy("");
    }
  }, [view.inboxId, view.network]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!view.inboxAddress) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-16 text-center">
        <h1 className="text-[32px] font-semibold tracking-[-0.025em]">Inbox</h1>
        <p className="mt-3 max-w-md text-[15px] leading-relaxed text-muted">An address with no name on it. Opening it takes one proof. Reading is free.</p>
        <div className="mt-6">
          <ProofButton phase={forge.phase} label="Open an inbox" settledLabel="Opened" disabled={Boolean(busy) || price === undefined} onClick={() => void create()} />
        </div>
        {error ? <p className="mt-3 text-[13px] text-danger">{error}</p> : null}
        {funds ? <Button href="/wallet?action=deposit" variant="secondary" className="mt-3">Add funds</Button> : null}
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-[1100px] flex-1 flex-col px-3 py-3 sm:px-6">
      <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl border border-line bg-surface">
        <aside className={cx("flex min-h-0 w-full flex-col md:w-[320px] md:border-r md:border-line", selected ? "hidden md:flex" : "flex")}>
          <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate font-mono text-[12px] text-text">{view.inboxAddress}</p>
              {expires ? <p className="truncate text-[11px] text-faint">Until {fullWhen(expires)}</p> : null}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                void copyText(view.inboxAddress ?? "").then(() => {
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1500);
                });
              }}
            >
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button variant="ghost" size="sm" disabled={Boolean(busy)} onClick={() => void refresh()}>
              {busy === "Reading…" ? "…" : "Refresh"}
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {error ? <p className="px-3 py-3 text-[13px] text-danger">{error}</p> : null}
            {messages.length === 0 && !error ? (
              <p className="px-3 py-8 text-center text-[13px] text-faint">{busy ? "Reading…" : "No messages yet."}</p>
            ) : (
              <ul>
                {messages.map((mail) => (
                  <li key={mail.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(mail.id)}
                      className={cx(
                        "block w-full border-b border-line px-3 py-3 text-left hover:bg-raised",
                        mail.id === selectedId ? "bg-raised" : "",
                      )}
                    >
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="truncate text-[14px] text-text">{mail.from}</span>
                        <span className="shrink-0 text-[12px] text-faint">{when(mail.at)}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-[13px] text-text">{mail.subject}</span>
                      {mail.preview ? <span className="mt-0.5 block truncate text-[12px] text-muted">{mail.preview}</span> : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
        <section className={cx("min-h-0 flex-1 flex-col", selected ? "flex" : "hidden md:flex")}>
          {selected ? (
            <>
              <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
                <Button variant="ghost" size="sm" className="md:hidden" onClick={() => setSelectedId(null)}>Back</Button>
                <h1 className="min-w-0 flex-1 truncate text-[16px] font-medium">{selected.subject}</h1>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                <p className="text-[14px] text-text">{selected.from}</p>
                {selected.at ? <p className="mt-1 text-[12px] text-faint">{fullWhen(selected.at)}</p> : null}
                <p className="mt-5 whitespace-pre-wrap text-[14px] leading-relaxed text-text">{selected.body || selected.preview || "This message has no text."}</p>
              </div>
            </>
          ) : (
            <div className="grid flex-1 place-items-center text-[14px] text-faint">Select a message</div>
          )}
        </section>
      </div>
      {funds ? <Button href="/wallet?action=deposit" variant="secondary" className="mt-3 self-start">Add funds</Button> : null}
    </div>
  );
}
