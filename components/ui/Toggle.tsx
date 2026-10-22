"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cx } from "@/lib/cx";

// Static class names so Tailwind can see them. The selected option's tint colours the pill and its label.
const tints = {
  gold: "tint-gold",
  warn: "tint-warn",
  anon: "tint-anon",
  "id-1": "tint-id-1",
  "id-2": "tint-id-2",
  "id-3": "tint-id-3",
  "id-4": "tint-id-4",
  "id-5": "tint-id-5",
  "id-6": "tint-id-6",
};

export type ToggleTint = keyof typeof tints;

export type ToggleOption<T extends string> = { value: T; label: ReactNode; tint?: ToggleTint };

const layouts = {
  segmented: { group: "inline-flex shrink-0 rounded-lg border border-line-strong p-0.5", item: "rounded-md", pill: "rounded-md" },
  chips: { group: "flex flex-wrap gap-2", item: "rounded-full border", pill: "rounded-full" },
};

const sizes = {
  sm: "px-2 py-1 text-[12px] sm:px-3 sm:text-[12.5px]",
  md: "px-3 py-1.5 text-[13px]",
};

/** Single-choice toggle. A pill slides to the selected option; buttons keep aria-pressed. */
export function Toggle<T extends string>({
  options,
  value,
  onChange,
  label,
  layout = "segmented",
  size = "md",
  disabled = false,
  className,
}: {
  options: ToggleOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  layout?: keyof typeof layouts;
  size?: keyof typeof sizes;
  disabled?: boolean;
  className?: string;
}) {
  const groupRef = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [animate, setAnimate] = useState(false);
  const active = options.find((option) => option.value === value);
  const look = layouts[layout];

  useLayoutEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    const place = () => {
      const button = group.querySelector<HTMLElement>('[aria-pressed="true"]');
      if (!button) return setPill(null);
      setPill({ x: button.offsetLeft, y: button.offsetTop, w: button.offsetWidth, h: button.offsetHeight });
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(group);
    return () => observer.disconnect();
  }, [value, options.length]);

  useLayoutEffect(() => {
    // Skip the slide on first placement so the pill doesn't fly in from the corner.
    if (pill && !animate) requestAnimationFrame(() => setAnimate(true));
  }, [pill, animate]);

  return (
    <div
      ref={groupRef}
      role="group"
      aria-label={label}
      className={cx("relative", look.group, tints[active?.tint ?? "gold"], className)}
    >
      {pill ? (
        <span
          aria-hidden="true"
          className={cx(
            "absolute left-0 top-0 border border-(--tint)/50 bg-raised shadow-elev-1",
            look.pill,
            animate && "transition-[translate,width,height,border-color] duration-(--dur-base) ease-move motion-reduce:transition-none",
          )}
          style={{ translate: `${pill.x}px ${pill.y}px`, width: pill.w, height: pill.h }}
        />
      ) : null}
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={cx(
              "relative whitespace-nowrap transition-[color,border-color] duration-(--dur-quick) ease-enter disabled:cursor-not-allowed disabled:opacity-50",
              look.item,
              sizes[size],
              selected ? "text-(--tint)" : "text-muted not-disabled:hover:text-text",
              selected && !pill && "bg-raised",
              layout === "chips" && (selected ? "border-transparent" : "border-line not-disabled:hover:border-line-strong"),
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
