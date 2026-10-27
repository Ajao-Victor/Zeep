"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { config } from "@/lib/config";
import { whenIdle } from "@/lib/fx/idle";
import { chooseTier, readSignals, stepDown, type Tier } from "@/lib/fx/tier";

// The WebGL backdrop shares the three.js chunk with the Proof Gate and loads only on tiers 2 and 3.
// Pause after the load event before fetching it, so it never competes with the hero.
const BACKDROP_DELAY_MS = 1200;
const BackdropScene = dynamic(() => import("@/components/fx/home-backdrop/BackdropScene"), { ssr: false });

/**
 * The landing page's full-page backdrop (styles/home.css), fixed behind the content:
 * - tier 0 (reduced motion, data saver, FX off): still aurora glows and grid;
 * - tier 1: the same in CSS, slowly moving (transform and opacity only);
 * - tiers 2 and 3: a WebGL field of requests flowing toward the viewer over a gold grid floor,
 *   with drifting lattices, fetched once the page has loaded and the browser is idle. It steps
 *   down to CSS when the frame rate sags, or when a lost context doesn't come back within a few
 *   seconds, and pauses in a hidden tab.
 * Tier 0 also marks <html data-home-still> so the page's floating cards hold still.
 */
export function HomeBackdrop() {
  const [tier, setTier] = useState<Tier | null>(null);
  const [load, setLoad] = useState(false);
  const [ready, setReady] = useState(false);
  const [shown, setShown] = useState(true);

  useEffect(() => {
    const chosen = chooseTier(readSignals(config.fxLevel));
    setTier(chosen);
    const root = document.documentElement;
    if (chosen === 0) root.dataset.homeStill = "true";
    // The hero (the LCP heading and the Proof Gate) gets the main thread first: the WebGL backdrop
    // starts only after the page has loaded, a short pause, and an idle moment. The CSS layers
    // cover the screen until then.
    let cancelIdle = () => {};
    let timer = 0;
    const start = () => {
      timer = window.setTimeout(() => {
        cancelIdle = whenIdle(() => setLoad(true));
      }, BACKDROP_DELAY_MS);
    };
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });
    const cancel = () => {
      window.removeEventListener("load", start);
      window.clearTimeout(timer);
      cancelIdle();
    };
    const onVisibility = () => setShown(!document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancel();
      delete root.dataset.homeStill;
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const onFps = useCallback((fps: number) => setTier((current) => (current === null ? current : stepDown(current, fps))), []);
  const onLost = useCallback(() => setTier(1), []);
  const onReady = useCallback(() => setReady(true), []);

  const webgl = tier === 2 || tier === 3;
  return (
    <div className="home-backdrop" data-tier={tier ?? "pending"} data-webgl={webgl && ready ? "ready" : undefined} aria-hidden="true">
      <div className="home-orb home-orb-gold" />
      <div className="home-orb home-orb-id" />
      <div className="home-orb home-orb-anon" />
      <div className="home-grid">
        <div className="home-grid-plane" />
      </div>
      {webgl && load ? (
        <div className="home-canvas">
          <BackdropScene tier={tier} active={shown} onFps={onFps} onLost={onLost} onReady={onReady} />
        </div>
      ) : null}
      <div className="home-vignette" />
    </div>
  );
}
