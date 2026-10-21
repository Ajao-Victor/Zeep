import { config } from "@/lib/config";

export function SiteFooter() {
  const sha = config.commitSha === "dev" ? "dev" : config.commitSha.slice(0, 7);
  return (
    <footer className="mt-auto border-t border-line py-7 text-[13px] text-faint">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-4 sm:px-8">
        <span>Zeep · private access, paid in shielded ZEC</span>
        <span className="flex flex-wrap items-center gap-x-2">
          {config.sourceUrl ? (
            <a href={config.sourceUrl} className="hover:text-text" rel="noreferrer">
              Open source
            </a>
          ) : (
            <span>Open source</span>
          )}
          <span>Reserve covers 100% of unused credits</span>
          <span className="font-mono">{sha}</span>
        </span>
      </div>
    </footer>
  );
}
