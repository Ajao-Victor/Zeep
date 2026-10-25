import type { FormEvent } from "react";
import { ProofButton } from "@/components/ui/ProofButton";
import type { ForgePhase } from "@/lib/fx/forge";

export function QueryBar({
  value,
  onChange,
  onSubmit,
  placeholder,
  label,
  phase,
  disabled,
  submitLabel,
  settledLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder: string;
  label: string;
  phase: ForgePhase;
  disabled: boolean;
  submitLabel: string;
  settledLabel: string;
}) {
  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <form
      role="search"
      onSubmit={submit}
      className="flex w-full items-center gap-2 rounded-full border border-line bg-surface py-1.5 pl-5 pr-1.5 shadow-elev-1"
    >
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="min-w-0 flex-1 bg-transparent py-2 text-[16px] text-text outline-none placeholder:text-faint"
      />
      <ProofButton type="submit" size="sm" phase={phase} label={submitLabel} settledLabel={settledLabel} disabled={disabled} />
    </form>
  );
}

export function ResultList({ items }: { items: { title: string; url?: string; snippet?: string }[] }) {
  if (!items.length) return null;
  return (
    <div className="mt-8">
      <p className="text-[13px] text-faint">{items.length === 1 ? "1 result" : `${items.length} results`}</p>
      <ol className="mt-5 grid gap-7">
      {items.map((item, index) => (
        <li key={`${item.url ?? item.title}-${index}`}>
          {item.url ? <p className="truncate text-[12px] text-ok">{hostOf(item.url)}</p> : null}
          {item.url ? (
            <a href={item.url} target="_blank" rel="noreferrer" className="text-[20px] leading-snug text-text hover:text-gold hover:underline">
              {item.title}
            </a>
          ) : (
            <p className="text-[20px] leading-snug text-text">{item.title}</p>
          )}
          {item.snippet ? <p className="mt-1 max-w-2xl text-[14px] leading-relaxed text-muted">{item.snippet}</p> : null}
        </li>
      ))}
      </ol>
    </div>
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}
