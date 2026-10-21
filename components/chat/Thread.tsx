"use client";

import type { ChatMessage } from "@/lib/chat/types";
import { messageText } from "@/lib/chat/types";

export function Thread({ messages }: { messages: ChatMessage[] }) {
  if (!messages.length) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <p className="text-[15px] text-text">No identity on this chat.</p>
        <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-muted">The proof shows the payment, not who you are. This history stays on this device.</p>
      </div>
    );
  }
  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-6">
      {messages.map((message, index) => {
        const images = Array.isArray(message.content) ? message.content.filter((part) => part.type === "image_url") : [];
        return (
          <article key={index} className={message.role === "user" ? "ml-auto max-w-[90%] rounded-xl bg-raised px-4 py-3" : "max-w-[90%]"}>
            <p className="mb-1 text-[12px] text-faint">{message.role === "user" ? "You" : "Zeep"}</p>
            <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{messageText(message)}</p>
            {images.map((part) =>
              part.type === "image_url" ? (
                <img key={part.image_url.url.slice(0, 48)} src={part.image_url.url} alt="" className="mt-2 max-h-48 rounded-lg" />
              ) : null,
            )}
          </article>
        );
      })}
    </div>
  );
}
