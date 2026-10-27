"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useVault } from "@/components/Providers";

export function RequireVault({ children }: { children: ReactNode }) {
  const { view } = useVault();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!view.ready) return;
    if (view.status === "unlocked") return;
    if (view.status === "wiped") router.replace("/restore");
    else if (view.status === "empty") router.replace("/");
    else router.replace(`/unlock?next=${encodeURIComponent(pathname)}`);
  }, [view.ready, view.status, router, pathname]);

  if (!view.ready) return <p className="px-8 py-16 text-muted">Checking this device…</p>;
  // Known but not unlocked (just locked, or a switch): the redirect above is already on its way,
  // so hold the space quietly instead of flashing a "checking" message before the Vault Door.
  if (view.status !== "unlocked") return <div className="min-h-[50vh]" aria-busy="true" />;
  return children;
}
