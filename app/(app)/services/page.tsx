import type { Metadata } from "next";
import { ServicesScreen } from "@/components/screens/ServicesScreen";

export const metadata: Metadata = { title: "Services" };

export default function ServicesPage() {
  return <ServicesScreen />;
}
