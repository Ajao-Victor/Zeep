import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "@/lib/cx";

const variants = {
  ghost: "text-muted not-disabled:hover:bg-raised not-disabled:hover:text-text aria-pressed:bg-raised aria-pressed:text-text",
  glass:
    "glass-1 glass-edge border border-line text-muted not-disabled:hover:border-line-strong not-disabled:hover:text-text aria-pressed:border-line-strong aria-pressed:text-text",
};

type Props = {
  /** Accessible name; icon-only buttons have no visible text. */
  label: string;
  variant?: keyof typeof variants;
  children: ReactNode;
  className?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label" | "children">;

/**
 * A 36px icon button with a 44x44 touch target: an invisible ::after extends the hit area
 * 4px on every side, so compact rows stay compact. Keep 8px between neighbours.
 */
export function IconButton({ label, variant = "ghost", children, className, type = "button", ...props }: Props) {
  return (
    <button
      type={type}
      aria-label={label}
      className={cx(
        "relative grid h-9 w-9 shrink-0 place-items-center rounded-lg after:absolute after:-inset-1",
        "transition-[background-color,border-color,color,scale] duration-(--dur-quick) ease-enter",
        "not-disabled:active:duration-(--dur-instant) motion-safe:not-disabled:active:scale-95",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
