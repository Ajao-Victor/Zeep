import { z } from "zod";
import { apiBase, type Network } from "@/lib/config";
import {
  chainInfoSchema,
  healthSchema,
  leavesSchema,
  refundResultSchema,
  remoteConfigSchema,
  reserveSchema,
  searchSchema,
  tagsSchema,
  type HealthResults,
  type LeafList,
  type RefundResult,
  type RemoteConfig,
  type ReserveBooks,
  type SearchResults,
} from "@/lib/api/schemas";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly stale = false,
  ) {
    super(message);
  }
}

async function request(
  network: Network,
  path: string,
  init: { method?: string; body?: unknown; proof?: string; accept?: string } = {},
): Promise<Response> {
  const base = apiBase(network);
  if (!base) throw new ApiError("No API is configured for this network.", 0);
  const headers = new Headers();
  headers.set("accept", init.accept ?? "application/json");
  if (init.body !== undefined) headers.set("content-type", "application/json");
  if (init.proof) headers.set("x-zeep-proof", init.proof);
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      method: init.method ?? "GET",
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      credentials: "omit",
      referrerPolicy: "no-referrer",
      cache: "no-store",
    });
  } catch {
    throw new ApiError("The Zeep API is unreachable.", 0);
  }
  return response;
}

async function parse<S extends z.ZodTypeAny>(response: Response, schema: S): Promise<z.output<S>> {
  const text = await response.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!response.ok) {
    const message =
      json && typeof json === "object" && "error" in json && typeof json.error === "string"
        ? json.error
        : `The API returned ${response.status}.`;
    const stale = response.status === 422 && /stale/i.test(message);
    throw new ApiError(message, response.status, stale);
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new ApiError("The API returned an unexpected response.", response.status);
  return parsed.data;
}

export function api(network: Network) {
  return {
    config(): Promise<RemoteConfig> {
      return request(network, "/v1/config").then((response) => parse(response, remoteConfigSchema));
    },
    leaves(seriesId: string): Promise<LeafList> {
      return request(network, `/v1/series/${encodeURIComponent(seriesId)}/leaves`).then((response) =>
        parse(response, leavesSchema),
      );
    },
    tags(seriesId: string, from?: string) {
      const query = from ? `?from=${encodeURIComponent(from)}` : "";
      return request(network, `/v1/series/${encodeURIComponent(seriesId)}/tags${query}`).then((response) =>
        parse(response, tagsSchema),
      );
    },
    reserve(): Promise<ReserveBooks> {
      return request(network, "/v1/reserve").then((response) => parse(response, reserveSchema));
    },
    chain() {
      return request(network, "/v1/chain").then((response) => parse(response, chainInfoSchema));
    },
    async chainCall(proof: string) {
      const response = await request(network, "/v1/chain/call", {
        method: "POST",
        body: { method: "getinfo" },
        proof,
      });
      if (!response.ok) await parse(response, z.object({}).passthrough());
    },
    search(body: { query: string }, proof: string): Promise<SearchResults> {
      return request(network, "/v1/search", { method: "POST", body, proof }).then((response) =>
        parse(response, searchSchema),
      );
    },
    health(body: { query: string }, proof: string): Promise<HealthResults> {
      return request(network, "/v1/health/lookup", { method: "POST", body, proof }).then((response) =>
        parse(response, healthSchema),
      );
    },
    chat(body: { model: string; messages: { role: string; content: string }[] }, proof: string) {
      return request(network, "/v1/ai/chat", {
        method: "POST",
        body,
        proof,
        accept: "text/event-stream",
      });
    },
    refund(body: { address: string; slots: number[]; proofs: unknown }, proof: string): Promise<RefundResult> {
      return request(network, "/v1/refund", { method: "POST", body, proof }).then((response) =>
        parse(response, refundResultSchema),
      );
    },
    refundStatus(id: string): Promise<RefundResult> {
      return request(network, `/v1/refund/${encodeURIComponent(id)}`).then((response) =>
        parse(response, refundResultSchema),
      );
    },
    registerAgent(body: unknown, proof: string) {
      return request(network, "/v1/agents", { method: "POST", body, proof });
    },
  };
}
