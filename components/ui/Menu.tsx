"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

/**
 * A floating glass panel for Radix dropdown menus: glass-2 with the lit edge and the highest
 * elevation, grown from the trigger. The panel scrolls when the list is taller than the space
 * above or below the button, so every item stays reachable.
 */
export function MenuContent({
  children,
  side = "bottom",
  align = "start",
  className,
}: {
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  className?: string;
}) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        side={side}
        align={align}
        sideOffset={8}
        collisionPadding={16}
        className={cx(
          "pop-in glass-2 glass-edge relative z-50 max-h-[var(--radix-dropdown-menu-content-available-height)] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-line-strong p-1 shadow-elev-2 outline-none",
          className,
        )}
      >
        {children}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  );
}

/** One choice in a DropdownMenu.RadioGroup. The selected row shows a gold check and full-strength text. */
export function MenuRadioItem({ value, children }: { value: string; children: ReactNode }) {
  return (
    <DropdownMenu.RadioItem
      value={value}
      className="relative cursor-pointer rounded-lg py-2 pl-8 pr-3 text-muted outline-none transition-colors duration-(--dur-quick) ease-enter data-[highlighted]:bg-raised data-[highlighted]:text-text data-[state=checked]:text-text"
    >
      <DropdownMenu.ItemIndicator className="absolute left-2.5 top-3 text-gold">
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M2 6.5 4.8 9 10 3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </DropdownMenu.ItemIndicator>
      {children}
    </DropdownMenu.RadioItem>
  );
}

/** Small print under a menu list. */
export function MenuNote({ children }: { children: ReactNode }) {
  return <p className="mt-1 border-t border-line px-3 pb-1 pt-2 text-[12px] leading-relaxed text-faint">{children}</p>;
}
