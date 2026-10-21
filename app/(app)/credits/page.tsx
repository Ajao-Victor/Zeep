import type { Metadata } from "next";
import { CreditsScreen } from "@/components/screens/CreditsScreen";

export const metadata: Metadata = { title: "Credits" };

export default function CreditsPage() {
  return <CreditsScreen />;
}
