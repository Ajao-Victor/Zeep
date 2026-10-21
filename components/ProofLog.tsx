export function ProofLog({ lines }: { lines: { id: string; tag: string; route: string }[] }) {
  return (
    <div className="h-28 overflow-hidden border-t border-line px-[18px] py-3.5 font-mono text-[12px] leading-[1.75] text-faint" aria-live="polite">
      {lines.map((line) => (
        <div key={line.id} className="zeep-in truncate">
          <span className="text-ok">✓</span> proof ok · tag {line.tag} · {line.route}
        </div>
      ))}
    </div>
  );
}
