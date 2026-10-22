import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "@/lib/cx";

// Hover and press styles are guarded with not-disabled: (not enabled:) so they also apply to links.
const variants = {
  primary:
    "sheen glass-edge bg-gold text-on-gold shadow-elev-gold not-disabled:hover:bg-gold-hover not-disabled:active:shadow-none",
  secondary:
    "glass-1 glass-edge border border-line-strong text-text not-disabled:hover:border-gold/40 not-disabled:hover:shadow-elev-1",
  ghost: "text-muted not-disabled:hover:bg-raised not-disabled:hover:text-text",
  danger: "tint-danger border border-(--tint) text-(--tint) not-disabled:hover:bg-line-strong",
};

const sizes = {
  md: "px-[18px] py-3 text-[15px]",
  sm: "px-3 py-2 text-[14px]",
};

type Props = {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  href?: string;
  children: ReactNode;
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({ variant = "primary", size = "md", href, children, className, type = "button", ...props }: Props) {
  const classes = cx(
    "relative inline-flex items-center justify-center rounded-lg font-medium",
    sizes[size],
    "transition-[background-color,border-color,box-shadow,color,translate] duration-(--dur-quick) ease-enter",
    "motion-safe:not-disabled:hover:-translate-y-px not-disabled:active:duration-(--dur-instant) motion-safe:not-disabled:active:translate-y-0",
    "disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none",
    variants[variant],
    className,
  );
  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} className={classes} {...props}>
      {children}
    </button>
  );
}
