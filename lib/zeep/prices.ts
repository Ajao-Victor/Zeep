export type PriceRoute = { micro_usd: number; credits?: number };

export type PriceModel = {
  id: string;
  name: string;
  host?: string;
  detail?: string;
  vision?: boolean;
  micro_usd: number;
  credits?: number;
};

export type PriceSheet = {
  micro_usd_per_credit: number;
  zec_usd: number;
  refresh_sec?: number;
  routes: Record<string, PriceRoute>;
  models: PriceModel[];
  attachments: { free_kb: number; micro_usd_per_mb: number; max_body_mb: number };
  default_model?: string;
};

export type FeeSheet = {
  free_network_fees_available: boolean;
  deposit: { zec_share_bps: number; fee_bps: number };
  withdrawal: { fee_bps: number; network_fee_zats: number; network_fees_micro_usd: number; min_micro_usd: number; min_micro_usd_for_free?: number };
};

/** model.micro_usd plus one attachment unit per MiB past the free 64 KB. */
export function chatCostMicro(modelMicro: number, bodyBytes: number, microPerMb: number): bigint {
  const extra = Math.ceil(Math.max(0, bodyBytes - 65536) / (1024 * 1024));
  return BigInt(modelMicro) + BigInt(extra) * BigInt(microPerMb);
}
