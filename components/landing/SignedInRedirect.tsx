"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useVault } from "@/components/VaultState";

/**
 * The landing page is for people without an account on this device. Providers mounts this on /
 * (from the layout, so the landing page's bundle stays as it was). Once a vault exists, it sends
 * them into the app: an unlocked balance to /services, a locked one straight to /unlock with
 * /services as the next page (one navigation, so the Vault Door mounts once). Only signing out,
 * which deletes the vault, brings the landing page back. Empty and wiped devices stay.
 */
export function SignedInRedirect() {
  const { view } = useVault();
  const router = useRouter();
  const signedIn = view.ready && (view.status === "unlocked" || view.status === "locked");

  useEffect(() => {
    if (!signedIn) return;
    router.replace(view.status === "unlocked" ? "/services" : `/unlock?next=${encodeURIComponent("/services")}`);
  }, [signedIn, view.status, router]);

  // Cover the landing page while the redirect is on its way, so it doesn't show through.
  return signedIn ? <div className="fixed inset-0 z-20 bg-bg" aria-hidden="true" /> : null;
}
