"use client";

import { useState } from "react";
import { copyText } from "@/lib/vault/clipboard";
import { Button } from "@/components/Button";

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
        <Button
          variant="secondary"
          size="sm"
          className="shrink-0"
          onClick={() => {
            void copyText(value, secret).then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            });
          }}
        >
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}
