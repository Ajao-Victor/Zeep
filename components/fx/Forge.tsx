import type { CSSProperties, ReactNode } from "react";
import type { ForgePhase } from "@/lib/fx/forge";

// The six identity colours, one mote each: what goes into the proof.
const MOTES = [1, 2, 3, 4, 5, 6].map((index) => ({
  "--mote": `var(--id-${index})`,
  "--angle": `${(index - 1) * 60}deg`,
  "--delay": `${(index - 1) * 40}ms`,
})) as CSSProperties[];

/** The phase glyph: identity motes, the proof lattice, the released white mote, the check. */
export function ForgeGlyph() {
  return (
    <span className="forge-glyph" aria-hidden="true">
      <span className="forge-orbit">
        {MOTES.map((style, index) => (
          <span key={index} className="forge-mote" style={style} />
        ))}
      </span>
      <span className="forge-glow" />
      <span className="forge-lattice">
        <svg width="14" height="14" viewBox="0 0 16 16">
          <path
            d="M8 1.2 13.9 4.6v6.8L8 14.8l-5.9-3.4V4.6zM8 1.2v13.6M2.1 4.6l11.8 6.8M13.9 4.6 2.1 11.4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="forge-spark" />
      <span className="forge-wait" />
      <span className="forge-check">
        <svg width="14" height="14" viewBox="0 0 16 16">
          <path d="M3.5 8.4 6.6 11.4 12.6 4.8" pathLength={1} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </span>
  );
}

/**
 * The Forge: the proof animation inside a button (see ProofButton). Renders the phase colour
 * layers behind `children`. The button must be `position: relative`; CSS lives in globals.css.
 */
export function Forge({ phase, children }: { phase: ForgePhase; children: ReactNode }) {
  return (
    <span className="forge" data-phase={phase}>
      <span className="forge-layer forge-identity" aria-hidden="true" />
      <span className="forge-layer forge-gold" aria-hidden="true" />
      <span className="forge-layer forge-white" aria-hidden="true" />
      <span className="forge-content">{children}</span>
    </span>
  );
}
