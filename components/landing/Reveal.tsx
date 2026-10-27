"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { config } from "@/lib/config";
import { cx } from "@/lib/cx";

/**
 * Rises its children in (styles/home.css .home-reveal) the first time they scroll into view.
 * Content already on screen at load is never hidden, and nothing is hidden without JavaScript,
 * under reduced motion or with FX off. `delay` staggers siblings, in ms.
 */
export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches || config.fxLevel === "off";
    if (still || node.getBoundingClientRect().top < window.innerHeight * 0.92) return;
    node.dataset.reveal = "hidden";
    const seen = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        node.dataset.reveal = "shown";
        seen.disconnect();
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    seen.observe(node);
    return () => seen.disconnect();
  }, []);

  return (
    <div ref={ref} className={cx("home-reveal", className)} style={{ "--reveal-delay": `${delay}ms` } as CSSProperties}>
      {children}
    </div>
  );
}
