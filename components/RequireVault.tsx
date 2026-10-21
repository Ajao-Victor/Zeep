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
    else if (view.status === "empty") router.replace("/get");
    else router.replace(`/unlock?next=${encodeURIComponent(pathname)}`);
  }, [view.ready, view.status, router, pathname]);

  if (!view.ready || view.status !== "unlocked") {
    return <p className="px-8 py-16 text-muted">Checking this device…</p>;
  }
  return children;
}
