export type PriceRoute = { micro_usd: number; credits?: number };

export type MeteredRate = {
  in_usd_per_m: number;
  out_usd_per_m: number;
  min_usd: number;
  default_output: number;
  max_output: number;
  bytes_per_token: number;
  image_tokens: number;
  message_tokens: number;
};

export type PriceModel = {
  id: string;
  name: string;
  host?: string;
  detail?: string;
  vision?: boolean;
  /** Price of a short question at the default output cap. Shown as "from … cr". */
  micro_usd: number;
  credits?: number;
  metered?: MeteredRate | null;
};

export type PriceSheet = {
  micro_usd_per_credit: number;
  zec_usd: number;
  refresh_sec?: number;
  markup_bps?: number;
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
