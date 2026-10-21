"use client";

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { chatCostZats } from "@/lib/zeep/prices";
import { isFundsError } from "@/lib/zeep/pay";
import { readSse } from "@/lib/api/sse";
import { readSession } from "@/lib/vault/session";
import { partsFrom, readAttachment } from "@/lib/chat/files";
import { loadChats, readChatPrefs, saveChat, writeChatPrefs } from "@/lib/chat/store";
import { deleteRemoteVault, pullChats, pushChat } from "@/lib/chat/sync";
import type { Attachment, Chat, ChatMessage, ChatPrefs } from "@/lib/chat/types";
import { titleFrom } from "@/lib/chat/types";
import { Button } from "@/components/Button";
import { useVault } from "@/components/Providers";
import { Composer, rejectKind } from "@/components/chat/Composer";
import { SettingsDialog } from "@/components/chat/SettingsDialog";
import { Sidebar } from "@/components/chat/Sidebar";
import { Thread } from "@/components/chat/Thread";

export function ChatScreen() {
  const { view } = useVault();
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [modelId, setModelId] = useState("");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState("");
  const [funds, setFunds] = useState(false);
  const [prefs, setPrefs] = useState<ChatPrefs>({ autodelete: false, sync: false });
  const [settings, setSettings] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(true);
  const active = chats.find((chat) => chat.id === activeId) ?? null;

  useEffect(() => {
    if (view.status !== "unlocked") {
      setChats([]);
      setActiveId(null);
      return;
    }
    const session = readSession();
    if (!session) return;
    let stop = false;
    void (async () => {
      const stored = await readChatPrefs(session.network);
      if (stop) return;
      setPrefs(stored);
      const loaded = stored.sync
        ? await pullChats(session.network, session.keys, stored.autodelete).catch(() => loadChats(session.network, session.keys.vaultKey, stored.autodelete))
        : await loadChats(session.network, session.keys.vaultKey, stored.autodelete);
      if (!stop) setChats(loaded);
    })();
    const timer = window.setInterval(() => {
      const current = readSession();
      if (!current) return;
      void readChatPrefs(current.network).then((next) => {
        if (!next.autodelete) return;
        void loadChats(current.network, current.keys.vaultKey, true).then(setChats);
      });
    }, 60 * 60 * 1000);
    return () => {
      stop = true;
      window.clearInterval(timer);
      setChats([]);
    };
  }, [view.status, view.network]);

  useEffect(() => {
    if (!modelId && view.prices?.models.length) {
      setModelId(view.prices.default_model || view.prices.models[0].id);
    }
  }, [modelId, view.prices]);

  function patch(id: string, update: (chat: Chat) => Chat) {
    setChats((current) => current.map((chat) => (chat.id === id ? update(chat) : chat)));
  }

  async function attach(files: FileList | File[]) {
    const model = view.prices?.models.find((item) => item.id === modelId);
    const next: Attachment[] = [];
    for (const file of [...files]) {
      const problem = rejectKind(file, Boolean(model?.vision));
      if (problem) {
        setHint(problem);
        continue;
      }
      try {
        next.push(await readAttachment(file));
      } catch (cause) {
        setHint(cause instanceof Error ? cause.message : "That file could not be read.");
      }
    }
    if (next.length) setAttachments((current) => [...current, ...next]);
  }

  async function send() {
    const session = readSession();
    const prices = session?.prices;
    const model = prices?.models.find((item) => item.id === modelId);
    if (!session || !prices || !model || busy) return;
    setHint("");
    setFunds(false);
    let parts;
    try {
      parts = partsFrom(draft, attachments, Boolean(model.vision));
    } catch (cause) {
      setHint(cause instanceof Error ? cause.message : "That message cannot be sent.");
      return;
    }
    const user: ChatMessage = { role: "user", content: parts.length === 1 && parts[0].type === "text" ? parts[0].text : parts };
    const base = active ?? {
      id: crypto.randomUUID(),
      title: titleFrom(user),
      model: model.id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [] as ChatMessage[],
    };
    const messages = [...base.messages, user];
    const body = JSON.stringify({ model: model.id, stream: true, messages });
    const bytes = new TextEncoder().encode(body).length;
    const max = (prices.attachments.max_body_mb || 20) * 1024 * 1024;
    if (bytes > max) {
      setHint(`This message is over ${prices.attachments.max_body_mb} MB.`);
      return;
    }
    const chat: Chat = { ...base, model: model.id, title: base.title || titleFrom(user), updatedAt: Date.now(), messages };
    setActiveId(chat.id);
    setChats((current) => [chat, ...current.filter((item) => item.id !== chat.id)]);
    setDraft("");
    setAttachments([]);
    setBusy(true);
    const assistant: ChatMessage = { role: "assistant", content: "" };
    patch(chat.id, (item) => ({ ...item, messages: [...messages, assistant] }));
    try {
      const response = await session.client.pay(
        "POST",
        "/v1/ai/chat/completions",
        body,
        chatCostZats(model.zats, bytes, prices.attachments.zats_per_mb),
      );
      let text = "";
      await readSse(response, (delta) => {
        text += delta;
        const next = text;
        patch(chat.id, (item) => ({
          ...item,
          messages: item.messages.map((message, index) => (index === item.messages.length - 1 ? { ...message, content: next } : message)),
        }));
      });
      const saved: Chat = { ...chat, updatedAt: Date.now(), messages: [...messages, { role: "assistant", content: text }] };
      patch(chat.id, () => saved);
      const blob = await saveChat(session.network, session.keys.vaultKey, saved);
      if (prefs.sync) await pushChat(session.network, session.keys, saved, blob, prefs.autodelete).catch((cause) => {
        setHint(cause instanceof Error ? cause.message : "Sync failed.");
      });
    } catch (cause) {
      setFunds(isFundsError(cause));
      setHint(cause instanceof Error ? cause.message : "The reply failed.");
    } finally {
      setBusy(false);
    }
  }

  async function changePrefs(next: ChatPrefs) {
    const session = readSession();
    setPrefs(next);
    if (session) await writeChatPrefs(session.network, next);
  }

  async function deleteAll() {
    const session = readSession();
    if (!session) return;
    await deleteRemoteVault(session.network, session.keys);
    setChats([]);
    setActiveId(null);
    setConfirmDelete(false);
    setSettings(false);
  }

  const sidebar = (
    <Sidebar
      chats={chats}
      activeId={activeId}
      query={query}
      onQuery={setQuery}
      onNew={() => {
        setActiveId(null);
        setDraft("");
        setAttachments([]);
        setDrawer(false);
      }}
      onOpen={(id) => {
        setActiveId(id);
        setDrawer(false);
      }}
      onSettings={() => {
        setSettings(true);
        setDrawer(false);
      }}
    />
  );

  return (
    <div className="relative flex h-[calc(100dvh-6.5rem)] min-h-0 overflow-hidden">
      <aside className="hidden w-12 shrink-0 flex-col items-center border-r border-line bg-surface py-3 sm:flex">
        <button
          type="button"
          aria-label={historyOpen ? "Hide chats" : "Show chats"}
          aria-pressed={historyOpen}
          onClick={() => setHistoryOpen((open) => !open)}
          className={historyOpen ? "grid h-9 w-9 place-items-center rounded-lg bg-raised text-text" : "grid h-9 w-9 place-items-center rounded-lg border border-line text-muted hover:bg-raised"}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <rect x="1.5" y="2" width="13" height="12" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
            <path d="M6 2v12" stroke="currentColor" strokeWidth="1.4" />
          </svg>
        </button>
      </aside>
      {historyOpen ? <aside className="hidden w-[272px] shrink-0 border-r border-line bg-surface sm:block">{sidebar}</aside> : null}
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-line px-3 py-2 sm:hidden">
          <Dialog.Root open={drawer} onOpenChange={setDrawer}>
            <Dialog.Trigger className="grid h-9 w-9 place-items-center rounded-lg border border-line" aria-label="Open chats">
              <span className="flex w-4 flex-col gap-1"><span className="h-px bg-current" /><span className="h-px bg-current" /><span className="h-px bg-current" /></span>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-40 bg-black/70" />
              <Dialog.Content className="fixed inset-y-0 left-0 z-50 flex w-full flex-col bg-surface outline-none">
                <Dialog.Title className="sr-only">Chats</Dialog.Title>
                <Dialog.Description className="sr-only">Chat history</Dialog.Description>
                {sidebar}
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
          <p className="truncate text-[14px]">{active?.title ?? "New chat"}</p>
        </header>
        <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col">
          <Thread messages={active?.messages ?? []} />
          {active ? <p className="px-4 pb-1 text-center text-[12px] text-faint">Zeep sees the prompt, not who sent it.</p> : null}
          {funds ? (
            <div className="px-4">
              <Button href="/deposit" variant="secondary">Add funds</Button>
            </div>
          ) : null}
          <Composer
            value={draft}
            onChange={setDraft}
            onSend={() => void send()}
            busy={busy}
            modelId={modelId}
            onModel={setModelId}
            prices={view.prices}
            attachments={attachments}
            onAttach={(files) => void attach(files)}
            onRemove={(id) => setAttachments((current) => current.filter((item) => item.id !== id))}
            hint={hint}
          />
        </div>
      </section>
      <SettingsDialog
        open={settings}
        onOpenChange={(open) => {
          setSettings(open);
          if (!open) setConfirmDelete(false);
        }}
        prefs={prefs}
        onPrefs={(next) => void changePrefs(next)}
        onDelete={() => void deleteAll()}
        confirm={confirmDelete}
        onConfirm={setConfirmDelete}
      />
    </div>
  );
}
