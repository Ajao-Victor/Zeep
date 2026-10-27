import type { ServiceId } from "@/lib/catalog";

// 24 px line icons in currentColor (gold on the landing cards), drawn in code: no icon font to host.
const PATHS: Record<ServiceId, string[]> = {
  ai: [
    "M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H10l-4 3.5V16A2 2 0 0 1 4 14z",
    "M12 6.9l.85 2.05 2.05.85-2.05.85L12 12.7l-.85-2.05-2.05-.85 2.05-.85z",
  ],
  search: ["M10.5 4.5a6 6 0 1 1 0 12 6 6 0 0 1 0-12z", "M15 15l4.5 4.5", "M8 10.5a2.5 2.5 0 0 1 2.5-2.5"],
  health: [
    "M12 19.5s-7-4.3-7-9.6A3.9 3.9 0 0 1 12 7.6a3.9 3.9 0 0 1 7 2.3c0 5.3-7 9.6-7 9.6z",
    "M7.8 12h2.1l1.1-1.9 1.7 3.8 1.1-1.9h2.4",
  ],
  inbox: [
    "M4 13l2.2-7A1.5 1.5 0 0 1 7.6 5h8.8a1.5 1.5 0 0 1 1.4 1L20 13v4.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z",
    "M4 13h4.5l1.5 2.5h4l1.5-2.5H20",
  ],
};

export function ServiceIcon({ id }: { id: ServiceId }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {PATHS[id].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
