"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { watchContextLoss } from "@/lib/fx/context";
import { createFpsSampler } from "@/lib/fx/fps";
import { Warmup } from "@/components/fx/Warmup";
import { Bokeh } from "@/components/fx/proof-gate/Bokeh";
import { Gate } from "@/components/fx/proof-gate/Gate";
import { Lanes } from "@/components/fx/proof-gate/Lanes";
import { Particles, type Flow, type Pointer } from "@/components/fx/proof-gate/Particles";
import type { SceneLayout } from "@/components/fx/proof-gate/layout";

const QUALITY = {
  2: { count: 1400, echoes: 0, bokeh: 16, dpr: [1, 1.5] as [number, number] },
  3: { count: 4200, echoes: 2, bokeh: 28, dpr: [1, 2] as [number, number] },
};

type Props = {
  layout: SceneLayout;
  tier: 2 | 3;
  active: boolean;
  source: HTMLElement | null;
  onCross: (crossed: number) => void;
  onFps: (fps: number) => void;
  onLost: () => void;
  onReady: () => void;
};

/** Reflections for the gold metal, generated in code: no HDRI file to fetch. */
function Environment() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const target = pmrem.fromScene(room, 0.04);
    scene.environment = target.texture;
    return () => {
      scene.environment = null;
      target.dispose();
      pmrem.dispose();
      room.dispose();
    };
  }, [gl, scene]);
  return null;
}

function World({ layout, tier, source, onCross, onFps }: Omit<Props, "active" | "onLost" | "onReady">) {
  const { viewport, gl } = useThree();
  const { width: vw, height: vh } = viewport;
  const px = vh / layout.height;

  const flow = useMemo<Flow>(() => {
    const toX = (x: number) => (x / layout.width - 0.5) * vw;
    const toY = (y: number) => (0.5 - y / layout.height) * vh;
    return {
      startX: toX(-12),
      endX: toX(layout.laneEnd),
      gateX: toX(layout.gate.x),
      gateY: toY(layout.gate.y),
      gateR: layout.gate.r * px,
      spreadTop: toY(layout.spread.top),
      spreadBottom: toY(layout.spread.bottom),
      laneStart: toX(layout.laneStart),
      lanes: layout.lanes.map(toY),
    };
  }, [layout, vw, vh, px]);

  const target = useRef<Pointer>({ x: 0, y: 0, on: 0 });
  const pointer = useRef<Pointer>({ x: 0, y: 0, on: 0 });
  const aim = useRef({ x: 0, y: 0 });
  const energy = useRef(0.35);
  const pulse = useRef(0);
  const sample = useMemo(() => createFpsSampler(onFps), [onFps]);

  useEffect(() => {
    if (!source) return;
    const local = (event: PointerEvent) => {
      const rect = gl.domElement.getBoundingClientRect();
      return { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height };
    };
    const move = (event: PointerEvent) => {
      const at = local(event);
      target.current = { x: (at.x - 0.5) * vw, y: (0.5 - at.y) * vh, on: 1 };
      aim.current = { x: at.x * 2 - 1, y: at.y * 2 - 1 };
    };
    const leave = () => {
      target.current = { ...target.current, on: 0 };
      aim.current = { x: 0, y: 0 };
    };
    const down = (event: PointerEvent) => {
      const at = local(event);
      const distance = Math.hypot(at.x * layout.width - layout.gate.x, at.y * layout.height - layout.gate.y);
      if (distance < layout.gate.r * 1.6) pulse.current = 1;
    };
    source.addEventListener("pointermove", move);
    source.addEventListener("pointerleave", leave);
    source.addEventListener("pointerdown", down);
    return () => {
      source.removeEventListener("pointermove", move);
      source.removeEventListener("pointerleave", leave);
      source.removeEventListener("pointerdown", down);
    };
  }, [source, gl, vw, vh, layout]);

  useFrame((state, delta) => {
    // Smooth pointer, so the repel field fades in and out instead of snapping.
    const current = pointer.current;
    current.x += (target.current.x - current.x) * 0.2;
    current.y += (target.current.y - current.y) * 0.2;
    current.on += (target.current.on - current.on) * 0.08;

    const near = Math.hypot(current.x - flow.gateX, current.y - flow.gateY) < flow.gateR * 2.2 ? current.on : 0;
    pulse.current *= 0.93;
    energy.current += (0.35 + near * 0.65 + pulse.current * 1.2 - energy.current) * 0.1;

    // About four degrees of parallax with the pointer.
    const camera = state.camera;
    camera.position.x += (aim.current.x * 0.35 - camera.position.x) * 0.05;
    camera.position.y += (-aim.current.y * 0.25 - camera.position.y) * 0.05;
    camera.lookAt(0, 0, 0);

    // Sustained frame rate for the tier step-down (lib/fx/fps.ts).
    sample(delta);
  });

  const quality = QUALITY[tier];
  return (
    <>
      <Bokeh flow={flow} count={quality.bokeh} />
      <Lanes lanes={flow.lanes} start={flow.laneStart} end={flow.endX} px={px} />
      <Particles flow={flow} count={quality.count} echoes={quality.echoes} pointer={pointer} onCross={onCross} />
      <Gate x={flow.gateX} y={flow.gateY} r={flow.gateR} energy={energy} />
    </>
  );
}

/** Tiers 2 and 3: the WebGL Proof Gate. Loaded on demand; never imported by app routes. */
export default function Scene3D({ layout, tier, active, source, onCross, onFps, onLost, onReady }: Props) {
  // Shaders compile in parallel before the first frame (Warmup); the poster stays until then.
  const [warm, setWarm] = useState(false);
  const onWarm = useCallback(() => {
    setWarm(true);
    onReady();
  }, [onReady]);
  const stopWatching = useRef<(() => void) | null>(null);
  useEffect(() => () => stopWatching.current?.(), []);
  return (
    <div aria-hidden="true" style={{ width: layout.width, height: layout.height }}>
      <Canvas
        dpr={QUALITY[tier].dpr}
        frameloop={active && warm ? "always" : "never"}
        camera={{ position: [0, 0, 10], fov: 35, near: 0.1, far: 50 }}
        gl={{ antialias: tier === 3, alpha: true, powerPreference: "high-performance" }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
          // A lost context gets a few seconds to come back before the scene falls back.
          stopWatching.current = watchContextLoss(gl.domElement, onLost);
        }}
      >
        <ambientLight intensity={0.3} />
        <directionalLight position={[4, 5, 8]} intensity={1.2} />
        <Environment />
        <World layout={layout} tier={tier} source={source} onCross={onCross} onFps={onFps} />
        <Warmup onWarm={onWarm} />
      </Canvas>
    </div>
  );
}
