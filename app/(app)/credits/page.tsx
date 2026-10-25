import { redirect } from "next/navigation";

export default function CreditsPage() {
  redirect("/wallet?action=withdraw");
}
