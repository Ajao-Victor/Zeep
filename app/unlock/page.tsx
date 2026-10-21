import { Suspense } from "react";
import type { Metadata } from "next";
import { UnlockFlow } from "@/components/flows/UnlockFlow";

export const metadata: Metadata = { title: "Unlock" };

export default function UnlockPage() {
  return (
    <Suspense fallback={<p className="px-8 py-16 text-muted">Loading…</p>}>
      <UnlockFlow />
    </Suspense>
  );
}
