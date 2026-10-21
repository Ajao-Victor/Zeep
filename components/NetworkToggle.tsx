import type { Network } from "@/lib/config";
import { cx } from "@/lib/cx";

export function NetworkToggle({
  network,
  onChange,
  disabled = false,
}: {
  network: Network;
  onChange: (network: Network) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex shrink-0 overflow-hidden rounded-lg border border-line-strong text-[12px] sm:text-[12.5px]" role="group" aria-label="Network">
      {(["testnet", "mainnet"] as const).map((item) => (
        <button
          key={item}
          type="button"
          disabled={disabled}
          aria-pressed={network === item}
          onClick={() => onChange(item)}
          className={cx(
            "whitespace-nowrap px-2 py-1.5 transition-colors duration-150 disabled:opacity-50 sm:px-3 sm:py-[7px]",
            network === item ? "bg-raised text-gold" : "text-muted hover:bg-line-strong hover:text-text",
          )}
        >
          {item === "testnet" ? "Testnet" : "Mainnet"}
        </button>
      ))}
    </div>
  );
}
