"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@/components/Toast";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { VaultState } from "@/components/VaultState";

export { useVault } from "@/components/VaultState";
export type { VaultView } from "@/components/VaultState";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <ToastProvider>
        <VaultState>
          <div className="flex min-h-screen flex-col">
            <a
              href="#content"
              className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-surface focus:px-3 focus:py-2"
            >
              Skip to content
            </a>
            <SiteHeader />
            <div id="content" className="flex-1">
              {children}
            </div>
            <SiteFooter />
          </div>
        </VaultState>
      </ToastProvider>
    </QueryClientProvider>
  );
}
