"use client";

import { useEffect, useRef } from "react";
import { ANON, GOLD, IDENTITY, type SceneLayout } from "@/components/fx/proof-gate/layout";

type Request = {
  x: number;
  wander: number;
  offset: number;
  vx: number;
  lane: number;
  color: string;
  passedAt: number;
  y: number;
  trail: [number, number][];
};

const smooth = (edge0: number, edge1: number, value: number) => {
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/** Tier 1: the scene on a 2D canvas. Pointer events come from `source`, since glass panels cover the canvas. */
export function LiteScene({
  layout,
  active,
  source,
  onCross,
}: {
  layout: SceneLayout;
  active: boolean;
  source: HTMLElement | null;
  onCross: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const crossRef = useRef(onCross);
  crossRef.current = onCross;

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const { width, height, gate, spread, lanes, laneStart, laneEnd } = layout;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);

    const requests: Request[] = [];
    const cap = Math.min(70, Math.max(24, Math.round(width / 10)));
    const mouse = { x: -1e4, y: -1e4 };
    let frame = 0;
    let raf = 0;

    function spawn() {
      const wander = spread.top + Math.random() * (spread.bottom - spread.top);
      requests.push({
        x: -8,
        wander,
        offset: (Math.random() - 0.5) * gate.r * 1.3,
        vx: 0.9 + Math.random() * 0.9,
        lane: (Math.random() * lanes.length) | 0,
        color: IDENTITY[(Math.random() * IDENTITY.length) | 0],
        passedAt: -1,
        y: wander,
        trail: [],
      });
    }

    function drawGate() {
      const near = Math.hypot(mouse.x - gate.x, mouse.y - gate.y) < gate.r * 2.2;
      const glow = context!.createRadialGradient(gate.x, gate.y, 0, gate.x, gate.y, gate.r * 1.4);
      glow.addColorStop(0, `rgba(217,164,65,${near ? 0.3 : 0.18})`);
      glow.addColorStop(1, "rgba(217,164,65,0)");
      context!.fillStyle = glow;
      context!.beginPath();
      context!.arc(gate.x, gate.y, gate.r * 1.4, 0, Math.PI * 2);
      context!.fill();
      context!.strokeStyle = GOLD;
      context!.globalAlpha = near ? 1 : 0.8;
      context!.lineWidth = 1.6;
      context!.beginPath();
      context!.arc(gate.x, gate.y, gate.r, 0, Math.PI * 2);
      context!.stroke();
      context!.globalAlpha = 1;
    }

    function tick() {
      frame += 1;
      context!.clearRect(0, 0, width, height);
      context!.strokeStyle = "#2e2c28";
      context!.lineWidth = 1;
      for (const y of lanes) {
        context!.beginPath();
        context!.moveTo(laneStart, y);
        context!.lineTo(laneEnd, y);
        context!.stroke();
      }
      drawGate();
      if (frame % 6 === 0 && requests.length < cap) spawn();
      for (const request of requests) {
        if (request.passedAt < 0) {
          request.x += request.vx;
          const dy = request.wander - mouse.y;
          const distance = Math.hypot(request.x - mouse.x, dy);
          if (distance < 70 && distance > 0) request.wander += (dy / distance) * 1.2;
          const funnel = smooth(gate.x - gate.r * 6, gate.x - gate.r * 0.4, request.x);
          request.y = request.wander + (gate.y + request.offset - request.wander) * funnel;
          if (request.x >= gate.x) {
            request.passedAt = frame;
            crossRef.current();
          }
        } else {
          request.x += request.vx * 1.15;
          const target = request.x < laneStart ? gate.y + request.offset : lanes[request.lane];
          request.y += (target - request.y) * 0.08;
        }
        request.trail.push([request.x, request.y]);
        if (request.trail.length > 12) request.trail.shift();
        const passed = request.passedAt >= 0;
        const flash = passed && frame - request.passedAt < 8;
        const color = flash ? GOLD : passed ? ANON : request.color;
        context!.strokeStyle = color;
        context!.globalAlpha = passed ? 0.2 : 0.3;
        context!.lineWidth = 2;
        context!.beginPath();
        request.trail.forEach(([x, y], index) => (index ? context!.lineTo(x, y) : context!.moveTo(x, y)));
        context!.stroke();
        context!.globalAlpha = 1;
        context!.fillStyle = color;
        context!.beginPath();
        context!.arc(request.x, request.y, flash ? 3.4 : passed ? 2.2 : 2.8, 0, Math.PI * 2);
        context!.fill();
      }
      for (let index = requests.length - 1; index >= 0; index -= 1) {
        if (requests[index].x > laneEnd) requests.splice(index, 1);
      }
    }

    function loop() {
      tick();
      raf = requestAnimationFrame(loop);
    }

    const onMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = event.clientX - rect.left;
      mouse.y = event.clientY - rect.top;
    };
    const onLeave = () => {
      mouse.x = -1e4;
      mouse.y = -1e4;
    };
    source?.addEventListener("pointermove", onMove);
    source?.addEventListener("pointerleave", onLeave);
    if (active) loop();
    else tick();
    return () => {
      cancelAnimationFrame(raf);
      source?.removeEventListener("pointermove", onMove);
      source?.removeEventListener("pointerleave", onLeave);
    };
  }, [layout, active, source]);

  return <canvas ref={canvasRef} aria-hidden="true" className="block" style={{ width: layout.width, height: layout.height }} />;
}
