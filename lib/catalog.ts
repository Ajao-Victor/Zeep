export type ServiceId = "ai" | "search" | "health" | "inbox";

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
  { id: "inbox", name: "Anonymous inbox", href: "/inbox", summary: "Email tied to no name or number.", route: "inbox" },
];

/** The service whose page is exactly `path`, or null. Used to trust a `next` query parameter. */
export function serviceAt(path: string | null) {
  return SERVICES.find((service) => service.href === path) ?? null;
}
