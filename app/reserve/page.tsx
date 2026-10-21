import type { Metadata } from "next";
import { ReserveScreen } from "@/components/screens/ReserveScreen";

export const metadata: Metadata = { title: "Reserve" };

export default function ReservePage() {
  return <ReserveScreen />;
}
