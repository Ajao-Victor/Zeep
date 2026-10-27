import { ohttpFetch } from "@/lib/zeep";
import { apiBase, config, type Network } from "@/lib/config";

const cache = new Map<Network, typeof fetch>();

export function ohttpMessage(status: number, code?: string): string | null {
  if (status === 422 && code === "ohttp_key") return "Zeep updated its privacy key. Reload the page.";
  if (status === 400 && code === "ohttp_decrypt") return "The request was damaged on the way. Try again.";
  return null;
}

/** Use this for every call to the Zeep API. Plain fetch() to the API is a bug. */
export function zeepFetch(network: Network): typeof fetch {
  let f = cache.get(network);
  if (!f) {
    const keyConfig = config.ohttpKey[network];
    const baseUrl = apiBase(network);
    if (!baseUrl) {
      const name = network === "mainnet" ? "NEXT_PUBLIC_API_BASE_URL_MAINNET" : "NEXT_PUBLIC_API_BASE_URL_TESTNET";
      throw new Error(`This build is missing its API address (${name}).`);
    }
    if (!keyConfig) throw new Error("This build is missing its privacy key (NEXT_PUBLIC_OHTTP_KEY_CONFIG).");
    const inner = ohttpFetch({ baseUrl, keyConfig });
    f = (async (input, init) => {
      const response = await inner(input, init);
      if (response.ok) return response;
      let code: string | undefined;
      try {
        const body = await response.clone().json();
        code = body?.error?.code;
      } catch {
        code = undefined;
      }
      const message = ohttpMessage(response.status, code);
      if (message) throw new Error(message);
      return response;
    }) as typeof fetch;
    cache.set(network, f);
  }
  return f;
}
