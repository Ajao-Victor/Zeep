import type { Metadata } from "next";
import { UnlockFlow } from "@/components/flows/UnlockFlow";

export const metadata: Metadata = { title: "Unlock" };

export default function UnlockPage() {
  return <UnlockFlow />;
}
