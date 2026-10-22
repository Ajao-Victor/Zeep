import { ANON, GOLD, IDENTITY, type SceneLayout } from "@/components/fx/proof-gate/layout";

// Deterministic, so the still frame is the same on every visit.
function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Tier 0: one still frame of the scene as SVG. Same story, no motion. */
export function Poster({ layout }: { layout: SceneLayout }) {
  const { width, height, gate, spread, lanes, laneStart, laneEnd } = layout;
  const next = random(7);
  const incoming = Array.from({ length: 64 }, (_, index) => {
    const x = next() * (gate.x - gate.r * 1.2);
    const wander = spread.top + next() * (spread.bottom - spread.top);
    const funnel = Math.max(0, Math.min(1, (x - (gate.x - gate.r * 6)) / (gate.r * 5)));
    const y = wander + (gate.y + (next() - 0.5) * gate.r * 1.4 - wander) * funnel;
    return { x, y, color: IDENTITY[index % IDENTITY.length] };
  });
  const outgoing = lanes.flatMap((y, lane) =>
    Array.from({ length: 4 }, (_, index) => ({ x: laneStart + ((laneEnd - laneStart) * (index + 0.3 + lane * 0.13)) / 4, y })),
  );

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" className="block">
      <defs>
        <radialGradient id="gate-glow">
          <stop offset="0%" stopColor={GOLD} stopOpacity="0.28" />
          <stop offset="70%" stopColor={GOLD} stopOpacity="0.08" />
          <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
        </radialGradient>
      </defs>
      {lanes.map((y) => (
        <line key={y} x1={laneStart} x2={laneEnd} y1={y} y2={y} stroke="#2e2c28" strokeWidth="1" />
      ))}
      {incoming.map((dot, index) => (
        <circle key={index} cx={dot.x} cy={dot.y} r="2.6" fill={dot.color} opacity="0.85" />
      ))}
      <circle cx={gate.x} cy={gate.y} r={gate.r * 1.35} fill="url(#gate-glow)" />
      <circle cx={gate.x} cy={gate.y} r={gate.r * 1.08} fill="none" stroke="#8f6418" strokeWidth="1" strokeDasharray="2 5" />
      <circle cx={gate.x} cy={gate.y} r={gate.r} fill="none" stroke={GOLD} strokeWidth="1.6" />
      {outgoing.map((dot, index) => (
        <circle key={index} cx={dot.x} cy={dot.y} r="2" fill={ANON} opacity="0.9" />
      ))}
    </svg>
  );
}
