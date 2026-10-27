"use client";

import { useRef, type PointerEvent, type ReactNode } from "react";
import Link from "next/link";
import { cx } from "@/lib/cx";

// Degrees of tilt at the card's edges.
const TILT_X = 7;
const TILT_Y = 9;

/**
 * A link card that tilts toward a fine pointer, with a gold spotlight at the pointer
 * (styles/home.css .home-tilt). It writes CSS variables on the element, so a move never
 * re-renders. Touch and pens get the plain card; reduced motion and FX off hold it flat in CSS.
 */
export function TiltLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLAnchorElement>(null);

  function move(event: PointerEvent<HTMLAnchorElement>) {
    const node = ref.current;
    if (!node || event.pointerType !== "mouse") return;
    const box = node.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width;
    const y = (event.clientY - box.top) / box.height;
    node.style.setProperty("--rx", `${((0.5 - y) * TILT_X).toFixed(2)}deg`);
    node.style.setProperty("--ry", `${((x - 0.5) * TILT_Y).toFixed(2)}deg`);
    node.style.setProperty("--mx", `${(x * 100).toFixed(1)}%`);
    node.style.setProperty("--my", `${(y * 100).toFixed(1)}%`);
    node.dataset.tilt = "on";
  }

  function leave() {
    const node = ref.current;
    if (!node) return;
    node.style.removeProperty("--rx");
    node.style.removeProperty("--ry");
    delete node.dataset.tilt;
  }

  return (
    <Link ref={ref} href={href} onPointerMove={move} onPointerLeave={leave} className={cx("home-tilt", className)}>
      {children}
    </Link>
  );
}
