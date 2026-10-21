"use client";

import { useState } from "react";
import { copyText } from "@/lib/vault/clipboard";

export function CopyField({
  label,
  value,
  secret = false,
}: {
  label: string;
  value: string;
  secret?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="min-w-0">
      <div className="text-[13px] text-muted">{label}</div>
      <div className="mt-1.5 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg border border-line bg-bg px-3 py-2 font-mono text-[12px] text-text">
          {value}
        </code>
        <button
          type="button"
          className="shrink-0 rounded-lg border border-line-strong px-3 py-2 text-[13px] hover:bg-raised"
          onClick={() => {
            void copyText(value, secret).then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            });
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
