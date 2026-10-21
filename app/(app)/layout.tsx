import { RequireVault } from "@/components/RequireVault";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <RequireVault>{children}</RequireVault>;
}
