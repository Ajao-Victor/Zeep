"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { config } from "@/lib/config";
import { cx } from "@/lib/cx";
import type { DoorPhase } from "@/lib/fx/door";

const BOLTS = [0, 60, 120, 180, 240, 300].map((angle) => ({ "--angle": `${angle}deg` }) as CSSProperties);

/** Reduced motion or FX off: the door cross-fades between phases instead of moving. */
function useStill(): boolean {
  const [still, setStill] = useState(config.fxLevel === "off");
  useEffect(() => {
    if (config.fxLevel === "off") return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setStill(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return still;
}

/**
 * The Vault Door (spec sections 1 and 7): the ceremony on create, unlock, lock and network switch.
 * Decorative only (aria-hidden): every state it shows is also written as text by the flow.
 * Styles live in styles/vault-door.css; the phase comes from useVaultDoor.
 */
export function VaultDoor({ phase, warn = false, className }: { phase: DoorPhase; warn?: boolean; className?: string }) {
  const still = useStill();
  return (
    <div className={cx("door", className)} data-phase={phase} data-warn={warn} data-still={still} aria-hidden="true">
      <div className="door-frame" />
      <div className="door-light" />
      <div className="door-stage">
        <div className="door-leaf">
          {(["outer", "middle", "inner"] as const).map((ring) => (
            <span key={ring} className={`door-ring door-ring-${ring}`}>
              <span className="door-band" />
              <span className="door-tick" />
            </span>
          ))}
          <span className="door-seam" />
          <span className="door-seam door-seam-warn" />
          <span className="door-seam door-seam-danger" />
          <span className="door-hub" />
        </div>
      </div>
      {BOLTS.map((style, index) => (
        <span key={index} className="door-bolt" style={style} />
      ))}
    </div>
  );
}
