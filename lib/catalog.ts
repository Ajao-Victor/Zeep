export type ServiceId = "ai" | "search" | "health" | "chain" | "inbox";

export const SERVICES: {
  id: ServiceId;
  name: string;
  href: string;
  summary: string;
  route: string | null;
}[] = [
  { id: "ai", name: "Private AI", href: "/ai", summary: "Open and frontier models, chat and API.", route: null },
  { id: "search", name: "Search & research", href: "/search", summary: "Web search, or research at Base, Core, or Pro.", route: "search" },
  { id: "health", name: "Health lookup", href: "/health", summary: "Drugs and clinical trials, no trail.", route: "health" },
  { id: "chain", name: "Blockchain access", href: "/chain", summary: "JSON-RPC through a paid proof.", route: "rpc100" },
  { id: "inbox", name: "Anonymous inbox", href: "/inbox", summary: "Email tied to no name or number.", route: "inbox" },
];

export const CHAINS = [
  { id: "ethereum", label: "Ethereum" },
  { id: "base", label: "Base" },
  { id: "solana", label: "Solana" },
] as const;
