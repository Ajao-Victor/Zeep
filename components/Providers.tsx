"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@/components/Toast";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { VaultState } from "@/components/VaultState";
import { SignedInRedirect } from "@/components/landing/SignedInRedirect";
import { config } from "@/lib/config";

export { useVault } from "@/components/VaultState";
export type { VaultView } from "@/components/VaultState";

export function Providers({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const fill = pathname === "/ai" || pathname === "/inbox";
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
      }),
  );
  if (config.network === "mainnet" && !config.ohttpKey.mainnet) {
    return <p className="px-8 py-16 text-[15px]">This build is missing its privacy key</p>;
  }
  return (
    <QueryClientProvider client={client}>
      <ToastProvider>
        <VaultState>
          <div className={fill ? "flex h-dvh flex-col overflow-hidden" : "flex min-h-dvh flex-col"}>
            <a
              href="#content"
              className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-surface focus:px-3 focus:py-2"
            >
              Skip to content
            </a>
            <SiteHeader />
            {pathname === "/" ? <SignedInRedirect /> : null}
            <div id="content" className={fill ? "flex min-h-0 flex-1 flex-col overflow-hidden" : "flex-1"}>
              {children}
            </div>
            <SiteFooter />
          </div>
        </VaultState>
      </ToastProvider>
    </QueryClientProvider>
  );
}
