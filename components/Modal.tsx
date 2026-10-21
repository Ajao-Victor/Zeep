"use client";

import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(440px,calc(100%-32px))] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-surface p-7 outline-none">
          <Dialog.Title className="text-[17px] font-medium tracking-[-0.01em]">{title}</Dialog.Title>
          {description ? <Dialog.Description className="mt-2 text-[14px] leading-relaxed text-muted">{description}</Dialog.Description> : null}
          <div className={description ? "mt-5" : "mt-4"}>{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
