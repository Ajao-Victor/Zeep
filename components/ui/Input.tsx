import type { ComponentProps } from "react";
import { cx } from "@/lib/cx";

// Static class names so Tailwind can see them. The tint colours the focus border and ring.
const tints = {
  gold: "tint-gold",
  anon: "tint-anon",
  "id-1": "tint-id-1",
  "id-2": "tint-id-2",
  "id-3": "tint-id-3",
  "id-4": "tint-id-4",
  "id-5": "tint-id-5",
  "id-6": "tint-id-6",
};

type FieldLook = {
  /** Marks the value as wrong: danger tint on the border and focus ring, plus aria-invalid. */
  invalid?: boolean;
  /** Focus colour when valid. Gold by default. */
  tint?: keyof typeof tints;
};

function fieldClasses({ invalid = false, tint = "gold" }: FieldLook, className?: string) {
  return cx(
    "w-full rounded-lg border px-3 py-2.5 text-[15px] text-text placeholder:text-faint",
    "glass-1 focus:glass-2 focus:shadow-elev-1",
    "transition-[background-color,border-color,box-shadow,backdrop-filter] duration-(--dur-base) ease-enter",
    "disabled:cursor-not-allowed disabled:opacity-50",
    invalid ? "tint-danger border-(--tint)/60" : cx(tints[tint], "border-line hover:border-line-strong focus:border-(--tint)/60"),
    className,
  );
}

/** Text input: glass at rest, raised glass on focus, tinted border and ring. */
export function Input({ invalid, tint, className, ...props }: FieldLook & ComponentProps<"input">) {
  return <input aria-invalid={invalid || undefined} className={fieldClasses({ invalid, tint }, className)} {...props} />;
}

/** Multi-line twin of Input. Not user-resizable unless `resizable`. */
export function Textarea({
  invalid,
  tint,
  resizable = false,
  className,
  ...props
}: FieldLook & { resizable?: boolean } & ComponentProps<"textarea">) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={fieldClasses({ invalid, tint }, cx(resizable ? "resize-y" : "resize-none", className))}
      {...props}
    />
  );
}
