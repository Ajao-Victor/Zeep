import type { Network } from "@/lib/config";
import { Toggle, type ToggleOption } from "@/components/ui/Toggle";

// Testnet takes the warn tint, matching the header's testnet badge.
const NETWORKS: ToggleOption<Network>[] = [
  { value: "testnet", label: "Testnet", tint: "warn" },
  { value: "mainnet", label: "Mainnet", tint: "gold" },
];

export function NetworkToggle({
  network,
  onChange,
  disabled = false,
}: {
  network: Network;
  onChange: (network: Network) => void;
  disabled?: boolean;
}) {
  return <Toggle options={NETWORKS} value={network} onChange={onChange} label="Network" size="sm" disabled={disabled} />;
}
