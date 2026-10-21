"use client";

import type { Chat } from "@/lib/chat/types";
import { messageText } from "@/lib/chat/types";
import { cx } from "@/lib/cx";

const GROUPS = ["Today", "Yesterday", "Previous 7 days", "Older"] as const;

function groupOf(updatedAt: number): (typeof GROUPS)[number] {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const day = 24 * 60 * 60 * 1000;
  if (updatedAt >= start.getTime()) return "Today";
  if (updatedAt >= start.getTime() - day) return "Yesterday";
  if (updatedAt >= start.getTime() - 7 * day) return "Previous 7 days";
  return "Older";
}

export function Sidebar({
  chats,
  activeId,
  query,
  onQuery,
  onNew,
  onOpen,
  onSettings,
}: {
  chats: Chat[];
  activeId: string | null;
  query: string;
  onQuery: (value: string) => void;
  onNew: () => void;
  onOpen: (id: string) => void;
  onSettings: () => void;
}) {
  const needle = query.trim().toLowerCase();
  const visible = needle
    ? chats.filter((chat) => chat.title.toLowerCase().includes(needle) || chat.messages.some((message) => messageText(message).toLowerCase().includes(needle)))
    : chats;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="grid gap-2 p-3">
        <button type="button" onClick={onNew} className="rounded-lg border border-line-strong px-3 py-2 text-left text-[14px] hover:bg-raised">
          New chat
        </button>
        <input
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Search chats"
          className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-[14px] outline-none placeholder:text-faint"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {GROUPS.map((group) => {
          const items = visible.filter((chat) => groupOf(chat.updatedAt) === group);
          if (!items.length) return null;
          return (
            <section key={group} className="mb-3">
              <p className="px-2 py-1 text-[12px] text-faint">{group}</p>
              {items.map((chat) => (
                <button
                  key={chat.id}
                  type="button"
                  onClick={() => onOpen(chat.id)}
                  className={cx(
                    "block w-full truncate rounded-lg px-2 py-2 text-left text-[14px]",
                    chat.id === activeId ? "bg-raised text-text" : "text-muted hover:bg-raised hover:text-text",
                  )}
                >
                  {chat.title}
                </button>
              ))}
            </section>
          );
        })}
      </div>
      <button type="button" onClick={onSettings} className="flex items-center gap-2 border-t border-line px-4 py-3 text-[14px] text-muted hover:bg-raised hover:text-text">
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="shrink-0">
          <circle cx="8" cy="8" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.2 3.2l1.4 1.4M11.4 11.4l1.4 1.4M12.8 3.2l-1.4 1.4M4.6 11.4l-1.4 1.4" fill="none" stroke="currentColor" strokeWidth="1.4" />
        </svg>
        Settings
      </button>
    </div>
  );
}
