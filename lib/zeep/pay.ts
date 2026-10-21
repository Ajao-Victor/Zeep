import { ZeepApiError, type ZeepClient } from "@/lib/zeep/client";

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
    throw new Error(message);
  }
  return body as T;
}

export async function payJson<T>(client: ZeepClient, method: string, path: string, value: unknown, costMicroUsd: bigint): Promise<T> {
  const body = JSON.stringify(value);
  const response = await client.pay(method, path, body, costMicroUsd);
  return readPaid<T>(response);
}
