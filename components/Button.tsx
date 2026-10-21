import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "@/lib/cx";

const variants = {
  primary: "bg-gold text-on-gold hover:bg-gold-hover",
  secondary: "border border-line-strong bg-transparent hover:bg-line-strong",
  danger: "border border-danger text-danger hover:bg-line-strong",
};

type Props = {
  variant?: keyof typeof variants;
  href?: string;
  children: ReactNode;
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({ variant = "primary", href, children, className, type = "button", ...props }: Props) {
  const classes = cx(
    "inline-flex items-center justify-center rounded-lg px-[18px] py-3 text-[15px] font-medium transition-[background-color,transform,border-color] duration-150 motion-safe:enabled:hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-50",
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
