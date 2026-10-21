import { z } from "zod";

export const planSchema = z.object({
  id: z.string(),
  name: z.string(),
  credits: z.number().int().positive(),
  zec: z.string(),
  blurb: z.string().optional().default(""),
});

export const remoteConfigSchema = z.object({
  seriesId: z.string(),
  payAddress: z.string().optional().default(""),
  plans: z.array(planSchema).optional(),
  walletServer: z.string().optional().default(""),
  rpcUrl: z.string().optional().default(""),
  root: z.string().optional().default(""),
});

export const leavesSchema = z.object({
  seriesId: z.string(),
  root: z.string(),
  leaves: z.array(
    z.object({
      commitment: z.string(),
      credits: z.number().int().nonnegative(),
    }),
  ),
});

export const tagsSchema = z.object({
  tags: z.array(z.string()),
  next: z.string().nullable().optional(),
});

export const reserveSchema = z.object({
  owed_micro_usd: z.number(),
  held_micro_usd: z.number(),
  coverage_pct: z.number(),
  totals: z.object({
    usd_deposits_micro_usd: z.number(),
    services_micro_usd: z.number(),
    usd_withdrawals_micro_usd: z.number(),
  }),
});

export const searchSchema = z.object({
  results: z.array(
    z.object({
      title: z.string(),
      url: z.string(),
      snippet: z.string(),
    }),
  ),
});

export const healthSchema = z.object({
  summary: z.string(),
  items: z.array(
    z.object({
      name: z.string(),
      kind: z.string(),
      note: z.string(),
    }),
  ),
});

export const inboxCreateSchema = z.object({
  address: z.string(),
});

export const inboxMessagesSchema = z.object({
  messages: z.array(
    z.object({
      id: z.string(),
      from: z.string(),
      body: z.string(),
      at: z.string(),
    }),
  ),
});

export const trancheSchema = z.enum(["pending", "seen", "confirmed", "failed"]);

export const refundResultSchema = z.object({
  id: z.string(),
  tranche1: trancheSchema,
  tranche2: trancheSchema,
});

export const chainInfoSchema = z.object({
  walletServer: z.string(),
  rpcUrl: z.string(),
});

export type RemoteConfig = z.infer<typeof remoteConfigSchema>;
export type LeafList = z.infer<typeof leavesSchema>;
export type ReserveBooks = z.infer<typeof reserveSchema>;
export type SearchResults = z.infer<typeof searchSchema>;
export type HealthResults = z.infer<typeof healthSchema>;
export type InboxMessages = z.infer<typeof inboxMessagesSchema>;
export type RefundResult = z.infer<typeof refundResultSchema>;
