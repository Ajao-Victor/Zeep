"use client";

import { useEffect, useRef } from "react";
import { cx } from "@/lib/cx";

/** What the dot row confirms: digits only, deriving, a wrong PIN, or a verified one. */
export type PinStatus = "idle" | "busy" | "error" | "ok";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "empty", "0", "del"];

// One short, identical pulse for every key, where the device supports it (Android). It confirms a
// press without saying which key, like the uniform dim below.
function buzz() {
  try {
    navigator.vibrate?.(8);
  } catch {
    // Vibration is optional; some browsers throw when it is blocked.
  }
}

/**
 * The PIN pad (spec sections 6 and 8). Secrets stay still: every key gets the same subtle dim
 * on press, with no ripple, glow or lift that would show a shoulder-surfer which digit was
 * entered. The visible confirmation happens on the dot row instead. Digits are DOM state only.
 */
export function PinPad({
  value,
  onChange,
  length,
  status = "idle",
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  length: number;
  status?: PinStatus;
  disabled?: boolean;
}) {
  const valueRef = useRef(value);
  valueRef.current = value;
  const locked = disabled || status === "busy";

  useEffect(() => {
    if (locked) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (/^\d$/.test(event.key)) {
        const next = (valueRef.current + event.key).slice(0, length);
        valueRef.current = next;
        onChange(next);
      } else if (event.key === "Backspace") {
        const next = valueRef.current.slice(0, -1);
        valueRef.current = next;
        onChange(next);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onChange, length, locked]);

  return (
    <div className="mx-auto w-full max-w-[240px]">
      <div className={cx("flex justify-center gap-2", status === "error" && "zeep-shake")} aria-hidden="true">
        {Array.from({ length }, (_, index) => {
          const filled = index < value.length || status === "ok";
          return (
            <span
              key={index}
              className={cx(
                "h-3 w-3 rounded-full border",
                "transition-[scale,background-color,border-color] duration-(--dur-base) ease-[cubic-bezier(0.34,1.56,0.64,1)]",
                filled ? "scale-100" : "scale-75",
                status === "ok"
                  ? "border-anon bg-anon"
                  : status === "error"
                    ? "border-danger bg-danger"
                    : filled
                      ? "border-gold bg-gold"
                      : "border-line-strong",
              )}
            />
          );
        })}
      </div>
      <p className="sr-only" aria-live="polite">
        {value.length} of {length} PIN digits
      </p>
      <div className="mt-4 grid grid-cols-3 gap-2" role="group" aria-label="PIN pad">
        {KEYS.map((key) =>
          key === "empty" ? (
            <span key={key} />
          ) : (
            <button
              key={key}
              type="button"
              disabled={locked}
              aria-label={key === "del" ? "Delete digit" : `Digit ${key}`}
              onClick={() => {
                buzz();
                const next = key === "del" ? valueRef.current.slice(0, -1) : (valueRef.current + key).slice(0, length);
                valueRef.current = next;
                onChange(next);
              }}
              className={cx(
                "glass-1 h-12 touch-manipulation select-none rounded-lg border border-line font-medium text-text",
                key === "del" ? "text-[14px]" : "text-[17px] tabular-nums",
                "transition-[background-color,opacity] duration-(--dur-instant)",
                "not-disabled:hover:border-line-strong not-disabled:active:bg-raised not-disabled:active:opacity-80",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              {key === "del" ? "Del" : key}
            </button>
          ),
        )}
      </div>
    </div>
  );
}
