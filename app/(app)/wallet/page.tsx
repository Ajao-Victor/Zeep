import { Suspense } from "react";
import type { Metadata } from "next";
import { WalletScreen } from "@/components/screens/WalletScreen";

export const metadata: Metadata = { title: "Wallet" };

export default function WalletPage() {
  return (
    <Suspense>
      <WalletScreen />
    </Suspense>
  );
}
