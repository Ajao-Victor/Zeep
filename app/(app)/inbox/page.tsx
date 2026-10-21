import type { Metadata } from "next";
import { InboxScreen } from "@/components/screens/InboxScreen";

export const metadata: Metadata = { title: "Inbox" };

export default function InboxPage() {
  return <InboxScreen />;
}
