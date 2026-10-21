import type { Metadata } from "next";
import { HealthScreen } from "@/components/screens/HealthScreen";

export const metadata: Metadata = { title: "Health" };

export default function HealthPage() {
  return <HealthScreen />;
}
