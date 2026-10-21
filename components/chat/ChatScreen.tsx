"use client";

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { chatCostMicro } from "@/lib/zeep/prices";
import { isFundsError } from "@/lib/zeep/pay";
import { readSse } from "@/lib/api/sse";
import { readSession } from "@/lib/vault/session";
import { expandMessages, readAttachment, storedParts } from "@/lib/chat/files";
import { deleteAllDeviceFiles, saveDeviceFile } from "@/lib/chat/blobs";
import { deleteChat, loadChats, readChatPrefs, saveChat, writeChatPrefs } from "@/lib/chat/store";
import { deleteRemoteChat, deleteRemoteVault, pullChats, pushChat } from "@/lib/chat/sync";
import type { Attachment, Chat, ChatMessage, ChatPrefs } from "@/lib/chat/types";
import { titleFrom } from "@/lib/chat/types";
import { SignOutDialog } from "@/components/account/SignOutDialog";
import { Button } from "@/components/Button";
import { useToast } from "@/components/Toast";
import { useVault } from "@/components/Providers";
import { Composer, rejectKind } from "@/components/chat/Composer";
import { SettingsDialog } from "@/components/chat/SettingsDialog";
import { Sidebar } from "@/components/chat/Sidebar";
import { Thread } from "@/components/chat/Thread";

export function ChatScreen() {
  const { view } = useVault();
  const toast = useToast();
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
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
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
    const prices = view.prices;
    const next: Attachment[] = [];
    let sawImage = false;
    for (const file of [...files]) {
      const problem = rejectKind(file);
      if (problem) {
        setHint(problem);
        continue;
      }
      if (file.type.startsWith("image/")) sawImage = true;
      try {
        next.push(await readAttachment(file));
      } catch (cause) {
        setHint(cause instanceof Error ? cause.message : "That file could not be read.");
      }
    }
    if (next.length) setAttachments((current) => [...current, ...next]);
    if (!sawImage || !prices) return;
    const current = prices.models.find((item) => item.id === modelId);
    if (current?.vision) return;
    const vision = [...prices.models].filter((item) => item.vision).sort((a, b) => a.micro_usd - b.micro_usd)[0];
    if (!vision) {
      setHint("No model in this list can read images.");
      return;
    }
    setModelId(vision.id);
    toast(`Switched to ${vision.name} to read your image`);
  }

  function chooseModel(id: string) {
    const prices = view.prices;
    const next = prices?.models.find((item) => item.id === id);
    const hasImage = attachments.some((item) => item.kind === "image");
    if (hasImage && next && !next.vision && prices) {
      const vision = [...prices.models].filter((item) => item.vision).sort((a, b) => a.micro_usd - b.micro_usd)[0];
      if (vision) {
        setModelId(vision.id);
        toast(`Switched to ${vision.name} to read your image`);
        return;
      }
    }
    setModelId(id);
  }

  async function send() {
    const session = readSession();
    const prices = session?.prices;
    const model = prices?.models.find((item) => item.id === modelId);
    if (!session || !prices || !model || busy) return;
    if (attachments.some((item) => item.kind === "image") && !model.vision) {
      const vision = [...prices.models].filter((item) => item.vision).sort((a, b) => a.micro_usd - b.micro_usd)[0];
      if (!vision) {
        setHint("No model in this list can read images.");
        return;
      }
      setModelId(vision.id);
      toast(`Switched to ${vision.name} to read your image`);
      return;
    }
    setHint("");
    setFunds(false);
    let parts;
    try {
      parts = storedParts(draft, attachments);
    } catch (cause) {
      setHint(cause instanceof Error ? cause.message : "That message cannot be sent.");
      return;
    }
    const chatId = active?.id ?? crypto.randomUUID();
    for (const item of attachments) {
      if (!item.bytes) continue;
      await saveDeviceFile(session.network, session.keys.vaultKey, {
        id: item.id,
        name: item.name,
        mime: item.mime,
        size: item.size,
        chatId,
        bytes: item.bytes,
        thumb: item.thumb,
        text: item.text,
      });
    }
    const user: ChatMessage = { role: "user", content: parts.length === 1 && parts[0].type === "text" ? parts[0].text : parts };
    const base = active ?? {
      id: chatId,
      title: titleFrom(user),
      model: model.id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [] as ChatMessage[],
    };
    const messages = [...base.messages, user];
    const apiMessages = await expandMessages(session.network, session.keys.vaultKey, messages);
    const body = JSON.stringify({ model: model.id, stream: true, messages: apiMessages });
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
    const assistant: ChatMessage = { role: "assistant", content: "", model: model.id };
    patch(chat.id, (item) => ({ ...item, messages: [...messages, assistant] }));
    try {
      const response = await session.client.pay(
        "POST",
        "/v1/ai/chat/completions",
        body,
        chatCostMicro(model.micro_usd, bytes, prices.attachments.micro_usd_per_mb),
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
      const saved: Chat = { ...chat, updatedAt: Date.now(), messages: [...messages, { role: "assistant", content: text, model: model.id }] };
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

  async function deleteCurrent() {
    const session = readSession();
    if (!session || !active) return;
    const chat = active;
    await deleteChat(session.network, chat);
    if (prefs.sync) {
      await deleteRemoteChat(session.network, session.keys, chat.id).catch((cause) => {
        setHint(cause instanceof Error ? cause.message : "The synced chat was not removed.");
      });
    }
    setChats((current) => current.filter((item) => item.id !== chat.id));
    setActiveId(null);
    setSettings(false);
  }

  async function clearFiles() {
    const session = readSession();
    if (!session) return;
    await deleteAllDeviceFiles(session.network);
    setSettings(false);
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
      <aside className="hidden w-12 shrink-0 flex-col items-center border-r border-line bg-surface py-3 sm:flex lg:hidden">
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
      <aside className="hidden w-[272px] shrink-0 border-r border-line bg-surface lg:block">{sidebar}</aside>
      {historyOpen ? (
        <div className="absolute inset-y-0 left-12 z-20 hidden w-[272px] border-r border-line bg-surface shadow-none sm:block lg:hidden">{sidebar}</div>
      ) : null}
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
          <Thread messages={active?.messages ?? []} modelName={(id) => view.prices?.models.find((item) => item.id === id)?.name || id} />
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
            onModel={chooseModel}
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
        onDeleteFiles={() => void clearFiles()}
        onDeleteChat={() => void deleteCurrent()}
        hasChat={Boolean(active)}
        onSignOut={() => {
          setSettings(false);
          setSignOutOpen(true);
        }}
      />
      <SignOutDialog open={signOutOpen} onOpenChange={setSignOutOpen} />
    </div>
  );
}
