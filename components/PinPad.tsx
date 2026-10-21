"use client";

import { useEffect, useRef } from "react";
import { cx } from "@/lib/cx";

export function PinPad({
  value,
  onChange,
  length,
}: {
  value: string;
  onChange: (value: string) => void;
  length: number;
}) {
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
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
  }, [onChange, length]);

  return (
    <div>
      <div className="flex gap-2" aria-hidden="true">
        {Array.from({ length }, (_, index) => (
          <span
            key={index}
            className={cx(
              "h-3 w-3 rounded-full border",
              index < value.length ? "border-gold bg-gold" : "border-line-strong",
            )}
          />
        ))}
      </div>
      <p className="sr-only" aria-live="polite">
        {value.length} of {length} PIN digits
      </p>
      <div className="mt-4 grid max-w-[240px] grid-cols-3 gap-2" role="group" aria-label="PIN pad">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "empty", "0", "del"].map((key) =>
          key === "empty" ? (
            <span key={key} />
          ) : (
            <button
              key={key}
              type="button"
              aria-label={key === "del" ? "Delete digit" : `Digit ${key}`}
              onClick={() => {
                const next = key === "del" ? valueRef.current.slice(0, -1) : (valueRef.current + key).slice(0, length);
                valueRef.current = next;
                onChange(next);
              }}
              className="h-12 rounded-lg border border-line-strong text-[15px] hover:bg-raised"
            >
              {key === "del" ? "Del" : key}
            </button>
          ),
        )}
      </div>
    </div>
  );
}
