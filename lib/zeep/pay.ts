import { rememberSpend } from "@/lib/account/activity";
import { formatUsd } from "@/lib/zeep/units";
import { ZeepApiError, type ZeepClient } from "@/lib/zeep/client";
import { readSession } from "@/lib/vault/session";

export class FundsError extends Error {
  readonly status = 402;
  readonly code = "insufficient";

  constructor(message = "This balance cannot cover that request.") {
    super(message);
  }
}

export function isFundsError(error: unknown): error is FundsError {
  return error instanceof FundsError || (error instanceof ZeepApiError && error.status === 402);
}

const BUSY = "Busy, try again in a few minutes; you were not charged.";

/** What to show when a paid request fails. A daily-limit refusal happens on this device, before any spend. */
export function requestError(cause: unknown, fallback: string): string {
  if (cause instanceof ZeepApiError && cause.code === "daily_limit") {
    const limit = readSession()?.client.dailySpending().limit;
    const amount = limit === undefined ? "" : ` (${formatUsd(limit)})`;
    return `You've reached your daily limit${amount}. Raise it in Settings or try again after midnight UTC.`;
  }
  if (cause instanceof ZeepApiError && cause.code === "ohttp_key") return "Zeep updated its privacy key. Reload the page.";
  if (cause instanceof ZeepApiError && cause.code === "ohttp_decrypt") return "The request was damaged on the way. Try again.";
  const message = cause instanceof Error ? cause.message : "";
  if (/upstream payment was not accepted/i.test(message)) return BUSY;
  return message || fallback;
}

export function upstreamBusy(status: number, message: string): string | null {
  if (status === 503 && /upstream payment was not accepted/i.test(message)) return BUSY;
  return null;
}

export async function readPaid<T>(response: Response): Promise<T> {
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok) {
    const record = body && typeof body === "object" ? (body as { error?: { message?: string; code?: string } }) : {};
    const message = record.error?.message ?? `The API returned ${response.status}.`;
    if (response.status === 402 || record.error?.code === "insufficient") throw new FundsError(message);
    throw new Error(upstreamBusy(response.status, message) ?? message);
  }
  return body as T;
}

export async function payJson<T>(client: ZeepClient, method: string, path: string, value: unknown, costMicroUsd: bigint): Promise<T> {
  const body = JSON.stringify(value);
  const response = await client.pay(method, path, body, costMicroUsd);
  const parsed = await readPaid<T>(response);
  await rememberSpend(client.keys.network, path, costMicroUsd).catch(() => undefined);
  return parsed;
}
