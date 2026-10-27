import { config } from "@/lib/config";

/**
 * A one-bit hint that this device holds a vault for this network, kept in localStorage so a
 * script in <head> can read it before anything paints (IndexedDB is asynchronous). It carries
 * no secret: the vault's existence is already visible in IndexedDB. VaultState keeps it in step
 * with the real status, so sign-out and a wipe clear it.
 */
const KEY = `zeep:account:${config.network}`;

export function setAccountHint(present: boolean) {
  try {
    if (present) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
  } catch {
    // Storage can be blocked (private mode, site data off). The hint is only an optimisation.
  }
}

/**
 * Inline <head> script: a full load of "/" on a device with an account goes straight to /unlock
 * (a fresh load is always locked, since the session lives in memory), so the landing page never
 * flashes. In-app navigation to "/" is handled by SignedInRedirect instead.
 */
export const accountHintScript = `try{if(location.pathname==="/"&&localStorage.getItem(${JSON.stringify(KEY)})==="1")location.replace("/unlock?next=%2Fservices")}catch(e){}`;
