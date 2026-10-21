"use client";

import type { ChatMessage } from "@/lib/chat/types";
import { messageText } from "@/lib/chat/types";
import { FileChip } from "@/components/chat/FileChip";

export function Thread({ messages, modelName }: { messages: ChatMessage[]; modelName: (id: string) => string }) {
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
        const files = Array.isArray(message.content) ? message.content.filter((part) => part.type === "file") : [];
        return (
          <article key={index} className="max-w-[90%]">
            <div className={message.role === "user" ? "ml-auto rounded-xl bg-raised px-4 py-3" : ""}>
              <p className="mb-1 text-[12px] text-faint">{message.role === "user" ? "You" : "Zeep"}</p>
              <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{messageText(message)}</p>
              {images.map((part) =>
                part.type === "image_url" ? (
                  <img key={part.image_url.url.slice(0, 48)} src={part.image_url.url} alt="" className="mt-2 max-h-48 rounded-lg" />
                ) : null,
              )}
              {files.map((part) => (part.type === "file" ? <FileChip key={part.id} file={part} /> : null))}
            </div>
            {message.role === "assistant" && message.model ? (
              <p className="mt-1 text-[12px] text-faint">{modelName(message.model)}</p>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
