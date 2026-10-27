"use client";

import { useCallback, useEffect, useState } from "react";
import { rememberSpend } from "@/lib/account/activity";
import { cx } from "@/lib/cx";
import { formatCredits } from "@/lib/zeep";
import { ZeepApiError, type InboxMessage, type InboxMessageItem } from "@/lib/zeep/client";
import { isFundsError, requestError } from "@/lib/zeep/pay";
import { copyText } from "@/lib/vault/clipboard";
import { readSession } from "@/lib/vault/session";
import { clearInbox, setInbox } from "@/lib/vault/vault";
import { Button } from "@/components/Button";
import { TextField } from "@/components/Panel";
import { useVault } from "@/components/Providers";
import { ProofButton } from "@/components/ui/ProofButton";
import { useForge } from "@/lib/fx/useForge";

const ADDRESS = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

function recipients(value: string): string[] {
  return value.split(/[,;\n]+/).map((item) => item.trim()).filter(Boolean);
}

function recipientError(to: string, cc: string): string {
  const all = [...recipients(to), ...recipients(cc)];
  if (!recipients(to).length) return "Add at least one recipient.";
  if (all.length > 10) return "At most 10 recipients.";
  if (all.some((item) => !ADDRESS.test(item))) return "Use plain addresses, like name@example.com.";
  return "";
}

function sendError(cause: unknown): string {
  if (cause instanceof ZeepApiError && cause.code === "daily_limit") return requestError(cause, "The message did not send.");
  if (cause instanceof ZeepApiError) {
    if (cause.status === 429 || cause.code === "rate_limited") return "Daily sending limit reached, try again tomorrow";
    if (cause.status === 400) return cause.message;
  }
  if (isFundsError(cause)) return cause instanceof Error ? cause.message : "This balance cannot cover that request.";
  return cause instanceof Error ? cause.message : "The message did not send.";
}

function gone(cause: unknown): boolean {
  return cause instanceof ZeepApiError && cause.status === 404;
}

function expiryLabel(iso: string): string {
  const end = new Date(iso).getTime();
  if (Number.isNaN(end)) return "";
  const days = Math.ceil((end - Date.now()) / 86_400_000);
  if (days <= 0) return "Inbox expires today";
  return days === 1 ? "Inbox expires in 1 day" : `Inbox expires in ${days} days`;
}

function when(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (date.toDateString() === new Date().toDateString()) return time;
  return `${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })} ${time}`;
}

function snippet(value: string): string {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > 200 ? `${text.slice(0, 200)}…` : text;
}

function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function hasRemoteImages(html: string): boolean {
  return /(?:src|srcset)\s*=\s*['"]?\s*(?:https?:)?\/\//i.test(html) || /url\(\s*['"]?\s*(?:https?:)?\/\//i.test(html);
}

function quietHtml(html: string, images: boolean): string {
  if (images) return html;
  return html
    .replace(/\s(?:src|srcset)\s*=\s*(['"])(?:https?:)?\/\/[^'"]*\1/gi, "")
    .replace(/url\(\s*(['"]?)(?:https?:)?\/\/[^)'"]+\1\s*\)/gi, "none");
}

export function InboxScreen() {
  const { view } = useVault();
  const [messages, setMessages] = useState<InboxMessageItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [expires, setExpires] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [letter, setLetter] = useState<InboxMessage | null>(null);
  const [mode, setMode] = useState<"read" | "compose" | "reply">("read");
  const [images, setImages] = useState(false);
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [replyAll, setReplyAll] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [funds, setFunds] = useState(false);
  const [copied, setCopied] = useState(false);
  const forge = useForge();
  const openPrice = view.prices?.routes.inbox?.micro_usd;
  const sendPrice = view.prices?.routes.inbox_send?.micro_usd;
  const openLabel = openPrice === undefined ? "Open an inbox" : `Open an inbox · ${formatCredits(openPrice, view.microPerCredit)} cr`;
  const sendLabel = sendPrice === undefined ? "Send" : `Send · ${formatCredits(sendPrice, view.microPerCredit)} cr`;

  const refresh = useCallback(async () => {
    const session = readSession();
    const id = session?.record.inboxId;
    if (!session || !id) return;
    setError("");
    try {
      const page = await session.client.inboxMessages(id, { limit: 30 });
      setExpires(page.expires_at);
      setMessages(page.messages);
      setCursor(page.next_cursor);
      if (new Date(page.expires_at).getTime() <= Date.now()) await clearInbox();
    } catch (cause) {
      if (gone(cause)) await clearInbox();
      else setError(cause instanceof Error ? cause.message : "Messages did not load.");
    }
  }, []);

  useEffect(() => {
    setMessages([]);
    setCursor(null);
    setOpenId(null);
    setLetter(null);
    setMode("read");
  }, [view.inboxId]);

  useEffect(() => {
    if (!view.inboxId) return;
    void refresh();
    const onFocus = () => { void refresh(); };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [view.inboxId, refresh]);

  async function create() {
    const session = readSession();
    if (!session || openPrice === undefined) return;
    setError("");
    setFunds(false);
    setBusy("Opening…");
    try {
      const created = await forge.track(() => session.client.createInbox());
      await setInbox(created.inbox_id, created.address);
      setExpires(created.expires_at);
      void rememberSpend(session.network, "/v1/inbox", BigInt(openPrice));
    } catch (cause) {
      setFunds(isFundsError(cause));
      setError(requestError(cause, "The inbox did not open."));
    } finally {
      setBusy("");
    }
  }

  async function older() {
    const session = readSession();
    const id = session?.record.inboxId;
    if (!session || !id || !cursor) return;
    setBusy("Older…");
    setError("");
    try {
      const page = await session.client.inboxMessages(id, { cursor, limit: 30 });
      setExpires(page.expires_at);
      setCursor(page.next_cursor);
      setMessages((current) => {
        const seen = new Set(current.map((item) => item.id));
        return [...current, ...page.messages.filter((item) => !seen.has(item.id))];
      });
    } catch (cause) {
      if (gone(cause)) await clearInbox();
      else setError(cause instanceof Error ? cause.message : "Older messages did not load.");
    } finally {
      setBusy("");
    }
  }

  async function open(id: string) {
    const session = readSession();
    const inboxId = session?.record.inboxId;
    if (!session || !inboxId) return;
    setMode("read");
    setOpenId(id);
    setLetter(null);
    setImages(false);
    setError("");
    try {
      const full = await session.client.readMessage(inboxId, id);
      setLetter(full);
      setMessages((current) => current.map((item) => item.id === id ? { ...item, read: true } : item));
    } catch (cause) {
      if (gone(cause)) await clearInbox();
      else setError(cause instanceof Error ? cause.message : "The message did not open.");
    }
  }

  function compose() {
    setMode("compose");
    setOpenId(null);
    setLetter(null);
    setTo("");
    setCc("");
    setSubject("");
    setBody("");
    setError("");
    setFunds(false);
  }

  function reply() {
    if (!letter) return;
    setMode("reply");
    setBody("");
    setReplyAll(false);
    setError("");
    setFunds(false);
  }

  async function send() {
    const session = readSession();
    const inboxId = session?.record.inboxId;
    if (!session || !inboxId || sendPrice === undefined) return;
    const problem = mode === "compose" ? recipientError(to, cc) : "";
    if (problem) {
      setError(problem);
      return;
    }
    if (!body.trim()) {
      setError("Write a message.");
      return;
    }
    setError("");
    setFunds(false);
    setBusy("Sending…");
    try {
      if (mode === "reply" && openId) {
        await forge.track(() => session.client.replyEmail(inboxId, openId, { text: body, replyAll }));
      } else {
        await forge.track(() => session.client.sendEmail(inboxId, {
          to: recipients(to),
          cc: recipients(cc).length ? recipients(cc) : undefined,
          subject,
          text: body,
        }));
      }
      void rememberSpend(session.network, "/v1/inbox/send", BigInt(sendPrice));
      setBody("");
      setMode("read");
      await refresh();
    } catch (cause) {
      if (gone(cause)) await clearInbox();
      else {
        setFunds(isFundsError(cause));
        setError(sendError(cause));
      }
    } finally {
      setBusy("");
    }
  }

  async function remove(id: string) {
    const session = readSession();
    const inboxId = session?.record.inboxId;
    if (!session || !inboxId) return;
    const previous = messages;
    setMessages((current) => current.filter((item) => item.id !== id));
    if (openId === id) {
      setOpenId(null);
      setLetter(null);
      setMode("read");
    }
    try {
      await session.client.deleteMessage(inboxId, id);
    } catch (cause) {
      if (gone(cause)) await clearInbox();
      else {
        setMessages(previous);
        setError(cause instanceof Error ? cause.message : "The message was not deleted.");
      }
    }
  }

  if (!view.inboxAddress) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-16 text-center">
        <h1 className="text-[32px] font-semibold tracking-[-0.025em]">Inbox</h1>
        <p className="mt-3 max-w-md text-[15px] leading-relaxed text-muted">An address with no name on it. Opening it takes one proof. Reading is free.</p>
        <div className="mt-6">
          <ProofButton phase={forge.phase} label={openLabel} settledLabel="Opened" disabled={Boolean(busy) || openPrice === undefined} onClick={() => void create()} />
        </div>
        {error ? <p className="mt-3 text-[13px] text-danger">{error}</p> : null}
        {funds ? <Button href="/wallet?action=deposit" variant="secondary" className="mt-3">Add funds</Button> : null}
      </div>
    );
  }

  const showing = mode === "compose" || mode === "reply" || Boolean(letter);
  const html = letter?.html ? quietHtml(letter.html, images) : "";

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-[1100px] flex-1 flex-col px-3 py-3 sm:px-6">
      <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl border border-line bg-surface">
        <aside className={cx("flex min-h-0 w-full flex-col md:w-[320px] md:border-r md:border-line", showing ? "hidden md:flex" : "flex")}>
          <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate font-mono text-[12px] text-text">{view.inboxAddress}</p>
              {expires ? <p className="truncate text-[11px] text-faint">{expiryLabel(expires)}</p> : null}
            </div>
            <Button variant="ghost" size="sm" onClick={() => void copyText(view.inboxAddress ?? "").then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1500); })}>
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button variant="ghost" size="sm" disabled={Boolean(busy)} onClick={() => void refresh()}>Refresh</Button>
            <Button variant="ghost" size="sm" onClick={compose}>New</Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {messages.length === 0 ? (
              <p className="px-3 py-8 text-center text-[13px] text-faint">No messages yet.</p>
            ) : (
              <ul>
                {messages.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => void open(item.id)}
                      className={cx("block w-full border-b border-line px-3 py-3 text-left hover:bg-raised", item.id === openId ? "bg-raised" : "")}
                    >
                      <span className="flex items-baseline justify-between gap-3">
                        <span className={cx("truncate text-[14px]", item.read ? "font-normal text-muted" : "font-medium text-text")}>{item.from || "Unknown"}</span>
                        <span className="shrink-0 text-[12px] text-faint">{when(item.received_at)}</span>
                      </span>
                      <span className={cx("mt-0.5 block truncate text-[13px]", item.read ? "font-normal text-muted" : "font-medium text-text")}>{item.subject || "(no subject)"}</span>
                      {item.preview ? <span className="mt-0.5 block truncate text-[12px] text-muted">{snippet(item.preview)}</span> : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {cursor ? (
              <div className="p-3">
                <Button variant="secondary" size="sm" disabled={Boolean(busy)} onClick={() => void older()}>{busy === "Older…" ? "Loading…" : "More"}</Button>
              </div>
            ) : null}
          </div>
        </aside>
        <section className={cx("min-h-0 flex-1 flex-col", showing ? "flex" : "hidden md:flex")}>
          {mode === "compose" || mode === "reply" ? (
            <form
              className="flex min-h-0 flex-1 flex-col"
              onSubmit={(event) => {
                event.preventDefault();
                void send();
              }}
            >
              <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
                <Button variant="ghost" size="sm" className="md:hidden" onClick={() => { setMode("read"); if (!letter) setOpenId(null); }}>Back</Button>
                <h1 className="min-w-0 flex-1 truncate text-[16px] font-medium">{mode === "reply" ? "Reply" : "New message"}</h1>
              </div>
              <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto px-4 py-4">
                {mode === "compose" ? (
                  <>
                    <TextField label="To" value={to} onChange={setTo} placeholder="name@example.com" />
                    <TextField label="Cc" value={cc} onChange={setCc} placeholder="Optional" />
                    <TextField label="Subject" value={subject} onChange={setSubject} />
                  </>
                ) : (
                  <label className="flex items-center gap-2 text-[13px] text-muted">
                    <input type="checkbox" checked={replyAll} onChange={(event) => setReplyAll(event.target.checked)} />
                    Reply all
                  </label>
                )}
                <label className="grid gap-1.5 text-[13px] text-muted">
                  Body
                  <textarea
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    rows={8}
                    className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-[14px] text-text outline-none"
                  />
                </label>
                {mode === "reply" && letter ? (
                  <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-bg px-3 py-2 text-[13px] text-muted">
                    {letter.text || letter.preview}
                  </pre>
                ) : null}
                {error ? <p className="text-[13px] text-danger">{error}</p> : null}
                {funds ? <Button href="/wallet?action=deposit" variant="secondary">Add funds</Button> : null}
                <div>
                  <ProofButton type="submit" phase={forge.phase} label={sendLabel} settledLabel="Sent" disabled={Boolean(busy) || sendPrice === undefined} />
                </div>
              </div>
            </form>
          ) : letter ? (
            <>
              <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
                <Button variant="ghost" size="sm" className="md:hidden" onClick={() => { setOpenId(null); setLetter(null); }}>Back</Button>
                <h1 className="min-w-0 flex-1 truncate text-[16px] font-medium">{letter.subject || "(no subject)"}</h1>
                <Button variant="ghost" size="sm" onClick={reply}>Reply</Button>
                <Button variant="ghost" size="sm" onClick={() => void remove(letter.id)}>Delete</Button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                <p className="text-[14px] text-text">{letter.from}</p>
                <p className="mt-1 text-[12px] text-faint">{when(letter.received_at)}</p>
                {letter.attachments.length ? (
                  <ul className="mt-3 grid gap-1 text-[13px] text-muted">
                    {letter.attachments.map((file) => (
                      <li key={`${file.filename}-${file.size}`}>{file.filename} · {fileSize(file.size)}</li>
                    ))}
                  </ul>
                ) : null}
                {letter.html ? (
                  <div className="mt-4">
                    {hasRemoteImages(letter.html) && !images ? (
                      <Button variant="secondary" size="sm" className="mb-3" onClick={() => setImages(true)}>Load images</Button>
                    ) : null}
                    <iframe
                      title="Message"
                      sandbox=""
                      referrerPolicy="no-referrer"
                      srcDoc={html}
                      className="h-[28rem] w-full rounded-lg border border-line bg-white"
                    />
                  </div>
                ) : (
                  <p className="mt-4 whitespace-pre-wrap text-[14px] leading-relaxed text-text">{letter.text || letter.preview || "This message has no text."}</p>
                )}
              </div>
            </>
          ) : (
            <div className="grid flex-1 place-items-center px-4 text-center text-[14px] text-faint">
              {error ? <p className="text-danger">{error}</p> : "Select a message"}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
