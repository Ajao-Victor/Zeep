"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { config } from "@/lib/config";
import { readSignals, chooseTier, stepDown, type Tier } from "@/lib/fx/tier";
import { whenIdle } from "@/lib/fx/idle";
import { LANES, sceneLayout } from "@/components/fx/proof-gate/layout";
import { LiteScene } from "@/components/fx/proof-gate/LiteScene";
import { Poster } from "@/components/fx/proof-gate/Poster";

// The WebGL scene (three.js + R3F) is its own chunk, fetched only when a device earns tier 2 or 3.
const Scene3D = dynamic(() => import("@/components/fx/proof-gate/Scene3D"), { ssr: false });

// Fade the scene in from the left and top edges, so nothing ends in a hard line at the box.
const EDGE_FADE = {
  maskImage: "linear-gradient(to right, transparent, #000 14%), linear-gradient(to bottom, transparent, #000 12%)",
  maskComposite: "intersect",
  WebkitMaskImage: "linear-gradient(to right, transparent, #000 14%), linear-gradient(to bottom, transparent, #000 12%)",
  WebkitMaskComposite: "source-in",
} as const;

/**
 * Picks the Proof Gate tier for this device and renders it inside a box that fills its parent:
 * the SVG poster, the 2D canvas, or the WebGL scene (fetched after first paint, poster shown until
 * it draws). Steps down when the frame rate sags, falls back to the poster on context loss, and
 * pauses off-screen or in a hidden tab. Lane labels are DOM, placed from the same layout.
 */
export function SceneFrame({
  source,
  reserveBottom,
  onCross,
}: {
  source: HTMLElement | null;
  reserveBottom: number;
  onCross: (crossed: number) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [tier, setTier] = useState<Tier | null>(null);
  const [load3d, setLoad3d] = useState(false);
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(true);
  const [shown, setShown] = useState(true);

  useEffect(() => {
    setTier(chooseTier(readSignals(config.fxLevel)));
    return whenIdle(() => setLoad3d(true));
  }, []);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const measure = () => setSize({ width: Math.round(box.clientWidth), height: Math.round(box.clientHeight) });
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(box);
    const seen = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    seen.observe(box);
    const onVisibility = () => setShown(!document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      resize.disconnect();
      seen.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const layout = useMemo(() => (size && size.width > 0 ? sceneLayout(size.width, size.height, reserveBottom) : null), [size, reserveBottom]);
  const active = visible && shown;
  const onFps = useCallback((fps: number) => setTier((current) => (current === null ? current : stepDown(current, fps))), []);
  const onLost = useCallback(() => setTier(0), []);
  const onReady = useCallback(() => setReady(true), []);
  const onCrossOne = useCallback(() => onCross(1), [onCross]);

  const webgl = tier === 2 || tier === 3;
  return (
    <div ref={boxRef} className="absolute inset-0 overflow-hidden" data-tier={tier ?? "pending"}>
      {layout ? (
        <>
          <div className="absolute inset-0" style={EDGE_FADE}>
            {tier === 0 || (webgl && !ready) ? (
              <div className="absolute inset-0">
                <Poster layout={layout} />
              </div>
            ) : null}
            {tier === 1 ? (
              <div className="absolute inset-0">
                <LiteScene layout={layout} active={active} source={source} onCross={onCrossOne} />
              </div>
            ) : null}
            {webgl && load3d ? (
              <div className="absolute inset-0">
                <Scene3D layout={layout} tier={tier} active={active} source={source} onCross={onCross} onFps={onFps} onLost={onLost} onReady={onReady} />
              </div>
            ) : null}
          </div>
          <ul className="pointer-events-none absolute inset-0 font-mono text-[11px] text-muted" aria-hidden="true">
            {LANES.map((lane, index) => (
              <li
                key={lane}
                className="absolute -translate-y-1/2 whitespace-nowrap text-right"
                style={{ top: layout.lanes[index], right: layout.width - layout.labelRight }}
              >
                {lane}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
