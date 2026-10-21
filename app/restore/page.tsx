import type { Metadata } from "next";
import { RestoreFlow } from "@/components/flows/RestoreFlow";

export const metadata: Metadata = { title: "Restore" };

export default function RestorePage() {
  return <RestoreFlow />;
}
