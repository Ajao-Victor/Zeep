"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
 *   with drifting lattices, fetched once the page has loaded and the browser is idle. A sustained
 *   frame-rate drop steps it 3 → 2 → lean before falling back to CSS, a lost context gets a few
 *   seconds to come back, and it pauses in a hidden tab.
 * Tier 0 also marks <html data-home-still> so the page's floating cards hold still.
 */
export function HomeBackdrop() {
  const [tier, setTier] = useState<Tier | null>(null);
  const [lean, setLean] = useState(false);
  const [load, setLoad] = useState(false);
  // Mirrors of tier and lean for the frame-rate callback, which must not run side effects inside
  // a state updater.
  const tierNow = useRef<Tier | null>(null);
  const leanNow = useRef(false);
  const [ready, setReady] = useState(false);
  const [shown, setShown] = useState(true);

  useEffect(() => {
    const chosen = chooseTier(readSignals(config.fxLevel));
    tierNow.current = chosen;
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

  // A sustained drop (lib/fx/fps.ts) steps 3 → 2, then 2 → lean WebGL, and only then to the CSS
  // backdrop (tier 1), so the star field stays as long as the device can carry it.
  const onFps = useCallback((fps: number) => {
    const current = tierNow.current;
    if (current === null) return;
    const next = stepDown(current, fps);
    if (next === current) return;
    if (current === 2 && !leanNow.current) {
      leanNow.current = true;
      setLean(true);
      return;
    }
    tierNow.current = next;
    setTier(next);
  }, []);
  const onLost = useCallback(() => {
    tierNow.current = 1;
    setTier(1);
  }, []);
  const onReady = useCallback(() => setReady(true), []);

  const webgl = tier === 2 || tier === 3;
  return (
    <div className="home-backdrop" data-tier={tier ?? "pending"} data-webgl={webgl && ready ? "ready" : undefined} data-lean={lean || undefined} aria-hidden="true">
      <div className="home-orb home-orb-gold" />
      <div className="home-orb home-orb-id" />
      <div className="home-orb home-orb-anon" />
      <div className="home-grid">
        <div className="home-grid-plane" />
      </div>
      {webgl && load ? (
        <div className="home-canvas">
          <BackdropScene tier={tier} lean={lean} active={shown} onFps={onFps} onLost={onLost} onReady={onReady} />
        </div>
      ) : null}
      <div className="home-vignette" />
    </div>
  );
}
