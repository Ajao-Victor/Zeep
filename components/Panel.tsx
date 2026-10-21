import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

export function Panel({
  children,
  className,
  padding = "panel",
}: {
  children: ReactNode;
  className?: string;
  padding?: "panel" | "card" | "none";
}) {
  return (
    <section
      className={cx(
        "rounded-xl border border-line bg-surface",
        padding === "panel" && "p-5 sm:p-7",
        padding === "card" && "p-5",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function Page({
  children,
  narrow = false,
}: {
  children: ReactNode;
  narrow?: boolean;
}) {
  return (
    <div className={cx("mx-auto px-4 py-8 sm:px-8", narrow ? "max-w-xl" : "max-w-[1200px]")}>{children}</div>
  );
}

export function PageIntro({
  kicker,
  title,
  lede,
}: {
  kicker?: string;
  title: string;
  lede?: string;
}) {
  return (
    <header className="pb-6 pt-4">
      {kicker ? <p className="text-[13px] text-muted">{kicker}</p> : null}
      <h1 className="mt-2 text-[32px] font-semibold tracking-[-0.025em]">{title}</h1>
      {lede ? <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted">{lede}</p> : null}
    </header>
  );
}

export function Notice({
  tone = "warn",
  children,
}: {
  tone?: "warn" | "danger" | "ok";
  children: ReactNode;
}) {
  const color = tone === "danger" ? "text-danger" : tone === "ok" ? "text-ok" : "text-warn";
  return <p className={cx("rounded-lg border border-line bg-surface px-3 py-2 text-[13px] leading-relaxed", color)}>{children}</p>;
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  autoComplete = "off",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block text-[13px] text-muted">
      {label}
      <input
        value={value}
        autoComplete={autoComplete}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-[15px] text-text outline-none placeholder:text-faint"
      />
    </label>
  );
}
