import type { Metadata } from "next";
import { ChainScreen } from "@/components/screens/ChainScreen";

export const metadata: Metadata = { title: "Chain" };

export default function ChainPage() {
  return <ChainScreen />;
}
