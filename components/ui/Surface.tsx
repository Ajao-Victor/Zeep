import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

const variants = {
  solid: "bg-surface",
  glass: "glass-1",
  overlay: "glass-2",
  hero: "glass-1 rounded-3xl",
};

const elevations = {
  0: "",
  1: "shadow-elev-1",
  2: "shadow-elev-2",
};

const paddings = {
  panel: "p-5 sm:p-7",
  card: "p-5",
  none: "",
};

// Static class names so Tailwind can see them. Tinted surfaces draw their border from --tint.
const tints = {
  gold: "tint-gold border-(--tint)/40",
  anon: "tint-anon border-(--tint)/30",
  ok: "tint-ok border-(--tint)/40",
  warn: "tint-warn border-(--tint)/40",
  danger: "tint-danger border-(--tint)/40",
  "id-1": "tint-id-1 border-(--tint)/40",
  "id-2": "tint-id-2 border-(--tint)/40",
  "id-3": "tint-id-3 border-(--tint)/40",
  "id-4": "tint-id-4 border-(--tint)/40",
  "id-5": "tint-id-5 border-(--tint)/40",
  "id-6": "tint-id-6 border-(--tint)/40",
};

export type SurfaceTint = keyof typeof tints;

type SurfaceProps = {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "article" | "aside" | "header" | "p";
  variant?: keyof typeof variants;
  elevation?: keyof typeof elevations;
  padding?: keyof typeof paddings;
  /** Lit 1px top edge. */
  edge?: boolean;
  tint?: SurfaceTint;
};

function surfaceClasses({
  variant = "glass",
  elevation = 1,
  padding = "panel",
  edge = true,
  tint,
}: Omit<SurfaceProps, "children" | "className" | "as">) {
  return cx(
    "relative rounded-xl border",
    variants[variant],
    elevations[elevation],
    paddings[padding],
    edge && "glass-edge",
    tint ? tints[tint] : "border-line",
  );
}

/** A panel, card or container. Glass by default; positioned so glass-edge can draw. */
export function Surface({ children, className, as: Tag = "section", ...look }: SurfaceProps) {
  return <Tag className={cx(surfaceClasses(look), className)}>{children}</Tag>;
}

const interactive =
  "transition-[box-shadow,border-color,background-color,translate] duration-(--dur-base) ease-enter hover:border-line-strong hover:shadow-elev-2 motion-safe:hover:-translate-y-0.5 active:duration-(--dur-instant) motion-safe:active:translate-y-0";

/** A Surface that responds to hover and press. With `href` it renders a link. */
export function Card({
  children,
  className,
  href,
  ...look
}: Omit<SurfaceProps, "as"> & { href?: string }) {
  const classes = cx(surfaceClasses({ padding: "card", ...look }), interactive, "flex flex-col", className);
  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }
  return <article className={classes}>{children}</article>;
}
