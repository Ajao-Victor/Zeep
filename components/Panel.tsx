import type { ComponentProps, ReactNode } from "react";
import { cx } from "@/lib/cx";
import { Input } from "@/components/ui/Input";
import { Surface } from "@/components/ui/Surface";

/** The app's standard panel: a glass Surface. Kept so existing screens migrate without edits. */
export function Panel(props: ComponentProps<typeof Surface>) {
  return <Surface {...props} />;
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
  return (
    <Surface as="p" tint={tone} elevation={0} padding="none" className="px-3 py-2 text-[13px] leading-relaxed text-(--tint)">
      {children}
    </Surface>
  );
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  autoComplete = "off",
  invalid = false,
  secret = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  invalid?: boolean;
  /** Recovery words: no spellcheck, autocorrect or autocapitalise, which can send text off the device. */
  secret?: boolean;
}) {
  return (
    <label className="block text-[13px] text-muted">
      {label}
      <Input
        value={value}
        autoComplete={autoComplete}
        placeholder={placeholder}
        invalid={invalid}
        spellCheck={secret ? false : undefined}
        autoCorrect={secret ? "off" : undefined}
        autoCapitalize={secret ? "none" : undefined}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5"
      />
    </label>
  );
}
