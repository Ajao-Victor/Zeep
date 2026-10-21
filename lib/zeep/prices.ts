export type PriceRoute = { usd?: number; zats: number };

export type PriceModel = {
  id: string;
  name: string;
  host?: string;
  detail?: string;
  vision?: boolean;
  usd?: number;
  zats: number;
};

export type PriceSheet = {
  zats_per_credit: number;
  refresh_sec: number;
  routes: Record<string, PriceRoute>;
  models: PriceModel[];
  attachments: { free_kb: number; zats_per_mb: number; max_body_mb: number; usd_per_mb?: number };
  default_model?: string;
};

/** model.zats plus one attachment unit per MiB past the free 64 KB. */
export function chatCostZats(modelZats: number, bodyBytes: number, zatsPerMb: number): bigint {
  const extra = Math.ceil(Math.max(0, bodyBytes - 65536) / (1024 * 1024));
  return BigInt(modelZats) + BigInt(extra) * BigInt(zatsPerMb);
}
