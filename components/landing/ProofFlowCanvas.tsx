"use client";

import { useEffect, useRef, useState } from "react";
import { config } from "@/lib/config";
import { ProofLog } from "@/components/ProofLog";

const COLORS = ["#C9785D", "#7FA7C9", "#B58AC9", "#8FBF9A", "#C9B26A", "#C98AA6"];
const LANES = ["Private AI", "Search", "Health", "Chain", "Inbox"];
const ROUTES = ["ai/chat", "search", "health/lookup", "rpc/zcash", "inbox"];

type Part = {
  x: number;
  y: number;
  vx: number;
  c: string;
  lane: number;
  passed: boolean;
  trail: [number, number][];
};

function tag() {
  return `0x${Math.random().toString(16).slice(2, 6)}…`;
}

export function ProofFlowCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [verified, setVerified] = useState(0);
  const [lines, setLines] = useState<{ id: string; tag: string; route: string }[]>([]);

  useEffect(() => {
    const seeded = Array.from({ length: 4 }, (_, index) => ({
      id: `seed-${index}`,
      tag: tag(),
      route: ROUTES[index % ROUTES.length],
    }));
    setLines(seeded);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches || !config.landingAnimation;
    if (reduce) return;
    const timer = window.setInterval(() => {
      setLines((current) =>
        [{ id: crypto.randomUUID(), tag: tag(), route: ROUTES[(Math.random() * ROUTES.length) | 0] }, ...current].slice(0, 4),
      );
    }, 1100);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches || !config.landingAnimation;
    let frame = 0;
    let width = 0;
    let height = 0;
    let gateX = 0;
    let running = true;
    let visible = true;
    let raf = 0;
    const mouse = { x: -1, y: -1 };
    const parts: Part[] = [];
    let seen = 0;

    const laneY = (index: number) => height * (0.16 + index * 0.17);
    const cap = () => Math.min(60, Math.max(18, Math.round(width / 22)));

    function size() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas!.clientWidth;
      height = canvas!.clientHeight;
      canvas!.width = Math.max(1, width * dpr);
      canvas!.height = Math.max(1, height * dpr);
      context!.setTransform(dpr, 0, 0, dpr, 0, 0);
      gateX = width * 0.46;
    }

    function roundRect(x: number, y: number, w: number, h: number, r: number) {
      context!.beginPath();
      context!.moveTo(x + r, y);
      context!.arcTo(x + w, y, x + w, y + h, r);
      context!.arcTo(x + w, y + h, x, y + h, r);
      context!.arcTo(x, y + h, x, y, r);
      context!.arcTo(x, y, x + w, y, r);
      context!.closePath();
    }

    function spawn() {
      parts.push({
        x: -6,
        y: height * 0.12 + Math.random() * height * 0.76,
        vx: 0.9 + Math.random() * 0.8,
        c: COLORS[(Math.random() * COLORS.length) | 0],
        lane: (Math.random() * 5) | 0,
        passed: false,
        trail: [],
      });
    }

    function drawStatic() {
      const narrow = width < 460;
      context!.font = `${narrow ? 10 : 11}px "JetBrains Mono", ui-monospace, monospace`;
      context!.fillStyle = "#87827A";
      context!.textAlign = "left";
      if (!narrow) context!.fillText("requests from many people", 14, 18);
      const glow = mouse.x >= 0 ? 0.22 : 0.12;
      context!.fillStyle = `rgba(217,164,65,${glow})`;
      const gateW = narrow ? 36 : 44;
      roundRect(gateX - gateW / 2, height * 0.08, gateW, height * 0.84, 10);
      context!.fill();
      context!.strokeStyle = "rgba(217,164,65,.55)";
      context!.lineWidth = 1;
      roundRect(gateX - gateW / 2, height * 0.08, gateW, height * 0.84, 10);
      context!.stroke();
      context!.save();
      context!.translate(gateX + 4, height * 0.5);
      context!.rotate(-Math.PI / 2);
      context!.fillStyle = "#D9A441";
      context!.textAlign = "center";
      context!.fillText(narrow ? "proof check" : "zero-knowledge proof check", 0, 0);
      context!.restore();
      context!.textAlign = "right";
      const labelRight = width - (narrow ? 8 : 14);
      const labelWidth = Math.max(...LANES.map((lane) => context!.measureText(lane).width));
      const lineEnd = labelRight - labelWidth - 8;
      LANES.forEach((lane, index) => {
        const y = laneY(index);
        const lineStart = gateX + gateW / 2 + 12;
        if (lineEnd > lineStart + 8) {
          context!.strokeStyle = "#22211E";
          context!.beginPath();
          context!.moveTo(lineStart, y);
          context!.lineTo(lineEnd, y);
          context!.stroke();
        }
        context!.fillStyle = "#8C877D";
        context!.fillText(lane, labelRight, y + 4);
      });
      context!.textAlign = "left";
    }

    function tick() {
      frame += 1;
      context!.clearRect(0, 0, width, height);
      drawStatic();
      if (frame % 9 === 0 && parts.length < cap()) spawn();
      for (const part of parts) {
        if (!part.passed) {
          part.x += part.vx;
          if (mouse.x >= 0) {
            const dy = part.y - mouse.y;
            const dx = part.x - mouse.x;
            const distance = Math.hypot(dx, dy);
            if (distance < 70 && distance > 0) part.y += (dy / distance) * 0.9;
          }
          if (part.x >= gateX) {
            part.passed = true;
            seen += 1;
            if (seen % 2 === 0) setVerified(seen);
          }
        } else {
          part.x += part.vx * 1.15;
          part.y += (laneY(part.lane) - part.y) * 0.06;
        }
        part.trail.push([part.x, part.y]);
        if (part.trail.length > 14) part.trail.shift();
        const color = part.passed ? "#ECE8E1" : part.c;
        context!.strokeStyle = color;
        context!.globalAlpha = part.passed ? 0.18 : 0.28;
        context!.lineWidth = 2;
        context!.beginPath();
        part.trail.forEach(([x, y], index) => (index ? context!.lineTo(x, y) : context!.moveTo(x, y)));
        context!.stroke();
        context!.globalAlpha = 1;
        context!.fillStyle = color;
        context!.beginPath();
        context!.arc(part.x, part.y, part.passed ? 2.2 : 3, 0, Math.PI * 2);
        context!.fill();
      }
      for (let i = parts.length - 1; i >= 0; i -= 1) {
        if (parts[i].x >= width - 96) parts.splice(i, 1);
      }
    }

    function loop() {
      if (!running || !visible || reduce) return;
      tick();
      raf = requestAnimationFrame(loop);
    }

    size();
    if (reduce) {
      for (let i = 0; i < 220; i += 1) {
        frame += 1;
        if (frame % 9 === 0 && parts.length < cap()) spawn();
        for (const part of parts) {
          part.x += part.vx;
          if (part.x >= gateX) {
            part.passed = true;
            part.y = laneY(part.lane);
          }
        }
      }
      tick();
    } else {
      loop();
    }

    const onResize = () => size();
    const onMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = event.clientX - rect.left;
      mouse.y = event.clientY - rect.top;
    };
    const onLeave = () => {
      mouse.x = -1;
      mouse.y = -1;
    };
    window.addEventListener("resize", onResize);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) loop();
    });
    observer.observe(canvas);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("resize", onResize);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface" aria-label="Live illustration: requests lose their identity at the Zeep proof check">
      <div className="flex items-center justify-between border-b border-line px-[18px] py-3.5 text-[12.5px] text-muted">
        <span>What Zeep sees</span>
        <span className="flex items-center gap-2">
          <i className="zeep-pulse inline-block h-1.5 w-1.5 rounded-full bg-gold" />
          simulated live
        </span>
      </div>
      <canvas
        ref={canvasRef}
        className="block h-[280px] w-full sm:h-[340px]"
        aria-label="Coloured requests pass through a gold proof check and leave as identical white requests for five services. None are linked to a person."
        tabIndex={-1}
      />
      <ProofLog lines={lines} />
      <div className="grid grid-cols-2 border-t border-line">
        <div className="px-[18px] py-3.5 text-[12.5px] text-muted">
          <b className="mb-0.5 block font-mono text-[20px] font-medium text-text">{verified.toLocaleString()}</b>
          requests verified
        </div>
        <div className="border-l border-line px-[18px] py-3.5 text-[12.5px] text-muted">
          <b className="mb-0.5 block font-mono text-[20px] font-medium text-text">0</b>
          linked to a person
        </div>
      </div>
    </div>
  );
}
