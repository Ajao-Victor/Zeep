import type { Metadata } from "next";
import { GetFlow } from "@/components/flows/GetFlow";

export const metadata: Metadata = { title: "Open a balance" };

export default function GetPage() {
  return <GetFlow />;
}
