import type { Metadata } from "next";
import { ChatScreen } from "@/components/chat/ChatScreen";

export const metadata: Metadata = { title: "Private AI" };

export default function AiPage() {
  return <ChatScreen />;
}
