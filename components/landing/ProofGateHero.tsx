"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { config } from "@/lib/config";
import { ProofLog } from "@/components/ProofLog";
import { SceneFrame } from "@/components/fx/proof-gate/SceneFrame";
import { Surface } from "@/components/ui/Surface";

const ROUTES = ["ai/chat", "search", "health/lookup", "inbox"];
// Height of the glass panel; the gate and lanes stay above it while requests pass behind it.
const PANEL = 236;

function tag() {
  return `0x${Math.random().toString(16).slice(2, 6)}…`;
}

/** The landing hero's live element: the Proof Gate scene with the glass "What Zeep sees" panel over it. */
export function ProofGateHero() {
  const [source, setSource] = useState<HTMLDivElement | null>(null);
  const [verified, setVerified] = useState(0);
  const [lines, setLines] = useState<{ id: string; tag: string; route: string }[]>([]);
  const crossed = useRef(0);

  const onCross = useCallback((count: number) => {
    crossed.current += count;
  }, []);

  useEffect(() => {
    setLines(Array.from({ length: 4 }, (_, index) => ({ id: `seed-${index}`, tag: tag(), route: ROUTES[index % ROUTES.length] })));
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches || config.fxLevel === "off";
    if (still) return;
    const counter = window.setInterval(() => setVerified(crossed.current), 500);
    const log = window.setInterval(() => {
      setLines((current) => [{ id: crypto.randomUUID(), tag: tag(), route: ROUTES[(Math.random() * ROUTES.length) | 0] }, ...current].slice(0, 4));
    }, 1100);
    return () => {
      window.clearInterval(counter);
      window.clearInterval(log);
    };
  }, []);

  return (
    <div ref={setSource} className="relative h-[480px] sm:h-[540px] lg:-mr-8">
      <div
        role="img"
        aria-label="Coloured requests pass through a gold proof gate and leave as identical white requests for four services. None are linked to a person."
        className="absolute inset-0"
      >
        <SceneFrame source={source} reserveBottom={PANEL} onCross={onCross} />
      </div>
      <div className="absolute inset-x-0 bottom-0 z-10">
        <Surface as="div" padding="none" elevation={2} className="overflow-hidden">
          <div className="flex items-center justify-between px-[18px] py-3.5 text-[12.5px] text-muted">
            <span>What Zeep sees</span>
            <span className="flex items-center gap-2">
              <i className="zeep-pulse inline-block h-1.5 w-1.5 rounded-full bg-gold" />
              simulated live
            </span>
          </div>
          <ProofLog lines={lines} />
          <div className="grid grid-cols-2 border-t border-line">
            <div className="px-[18px] py-3 text-[12.5px] text-muted">
              <b className="mb-0.5 block font-mono text-[20px] font-medium text-text tabular-nums">{verified.toLocaleString()}</b>
              requests verified
            </div>
            <div className="border-l border-line px-[18px] py-3 text-[12.5px] text-muted">
              <b className="mb-0.5 block font-mono text-[20px] font-medium text-text">0</b>
              linked to a person
            </div>
          </div>
        </Surface>
      </div>
    </div>
  );
}
