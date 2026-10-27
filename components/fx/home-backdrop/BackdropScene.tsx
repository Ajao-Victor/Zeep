"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { ANON, GOLD, IDENTITY } from "@/components/fx/proof-gate/layout";
import { watchContextLoss } from "@/lib/fx/context";
import { createFpsSampler } from "@/lib/fx/fps";
import { Warmup } from "@/components/fx/Warmup";

// Depth of the field in world units. Everything flows toward the camera and wraps at this depth.
const DEPTH = 140;

const QUALITY = {
  2: { stars: 2600, lattices: 5, dpr: [0.75, 1] as [number, number] },
  3: { stars: 7000, lattices: 8, dpr: [1, 1.5] as [number, number] },
};

// The last stage before HomeBackdrop gives up on WebGL: about a quarter of the pixels to fill.
const LEAN = { stars: 1200, lattices: 4, dpr: [0.5, 0.6] as [number, number] };

type Props = {
  tier: 2 | 3;
  /** Lighter: fewer stars and lattices at about half the pixel density. */
  lean: boolean;
  active: boolean;
  onFps: (fps: number) => void;
  onLost: () => void;
  onReady: () => void;
};

// Requests far away keep their identity colour, turn gold as they pass the middle of the field (the
// proof) and leave anonymous white as they reach the viewer: the page's colour story, in depth.
const starVertex = /* glsl */ `
  attribute float aSeed;
  attribute float aSize;
  attribute vec3 aColor;
  uniform float uTime;
  uniform float uTravel;
  uniform float uPixelRatio;
  uniform vec3 uGold;
  uniform vec3 uAnon;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec3 p = position;
    p.z = mod(p.z + uTime * (1.2 + aSeed * 1.6) + uTravel, ${DEPTH}.0) - ${DEPTH}.0;
    p.x += sin(uTime * 0.15 + aSeed * 30.0) * 0.6;
    p.y += cos(uTime * 0.12 + aSeed * 20.0) * 0.4;
    float near = clamp(1.0 + p.z / ${DEPTH}.0, 0.0, 1.0);
    vec3 color = mix(aColor, uGold, smoothstep(0.35, 0.7, near));
    vColor = mix(color, uAnon, smoothstep(0.75, 0.95, near));
    vAlpha = smoothstep(0.0, 0.25, near) * (1.0 - smoothstep(0.93, 1.0, near));
    vec4 view = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * view;
    gl_PointSize = aSize * uPixelRatio * (40.0 / -view.z);
  }
`;

const starFragment = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float a = exp(-dot(p, p) * 18.0) * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor, a);
    #include <colorspace_fragment>
  }
`;

const floorVertex = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

// An endless gold grid under the field. Lines are antialiased with fwidth (WebGL2 only, which is
// all these tiers run on) and fade with distance and toward the sides, like a vault floor in fog.
const floorFragment = /* glsl */ `
  uniform float uTravel;
  uniform vec3 uGold;
  varying vec3 vWorld;
  float gridLine(float v) {
    float f = abs(fract(v - 0.5) - 0.5);
    return 1.0 - smoothstep(0.0, max(fwidth(v) * 1.2, 0.0001), f);
  }
  void main() {
    vec2 cell = vec2(vWorld.x, vWorld.z - uTravel) / 4.0;
    float line = max(gridLine(cell.x), gridLine(cell.y));
    float distance = -vWorld.z;
    float fade = (1.0 - smoothstep(20.0, 150.0, distance)) * smoothstep(-5.0, 6.0, distance);
    float side = 1.0 - smoothstep(40.0, 110.0, abs(vWorld.x));
    float a = line * fade * side * 0.32;
    if (a < 0.003) discard;
    gl_FragColor = vec4(uGold, a);
    #include <colorspace_fragment>
  }
`;

function Stars({ count, travel }: { count: number; travel: { current: number } }) {
  const material = useRef<THREE.ShaderMaterial>(null);
  const { gl } = useThree();
  const geometry = useMemo(() => {
    const position = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    const size = new Float32Array(count);
    const color = new Float32Array(count * 3);
    const tint = new THREE.Color();
    for (let index = 0; index < count; index += 1) {
      // A wide, shallow volume: denser toward the sides so the middle of the page stays readable.
      const side = Math.random() < 0.5 ? -1 : 1;
      const x = side * (2 + Math.pow(Math.random(), 0.7) * 34);
      position.set([x, -6 + Math.random() * 22, -Math.random() * DEPTH], index * 3);
      seed[index] = Math.random();
      size[index] = 1.4 + Math.random() * 3.2;
      tint.set(IDENTITY[index % IDENTITY.length]);
      color.set([tint.r, tint.g, tint.b], index * 3);
    }
    const built = new THREE.BufferGeometry();
    built.setAttribute("position", new THREE.BufferAttribute(position, 3));
    built.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    built.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    built.setAttribute("aColor", new THREE.BufferAttribute(color, 3));
    return built;
  }, [count]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  // Initial values only: R3F copies uniforms into the material, so updates go through the ref.
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uTravel: { value: 0 },
      uPixelRatio: { value: 1 },
      uGold: { value: new THREE.Color(GOLD) },
      uAnon: { value: new THREE.Color(ANON) },
    }),
    [],
  );

  useFrame((state) => {
    const live = material.current?.uniforms;
    if (!live) return;
    live.uTime.value = state.clock.elapsedTime;
    live.uTravel.value = travel.current;
    live.uPixelRatio.value = gl.getPixelRatio();
  });

  return (
    <points geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={starVertex}
        fragmentShader={starFragment}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function Floor({ travel }: { travel: { current: number } }) {
  const material = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uTravel: { value: 0 }, uGold: { value: new THREE.Color(GOLD) } }), []);
  useFrame(() => {
    const live = material.current?.uniforms;
    if (live) live.uTravel.value = travel.current;
  });
  return (
    <mesh position={[0, -7, -95]} rotation={[-Math.PI / 2, 0, 0]} frustumCulled={false}>
      <planeGeometry args={[240, 200]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={floorVertex}
        fragmentShader={floorFragment}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

type Lattice = { geometry: THREE.EdgesGeometry; x: number; y: number; z: number; spin: number; bob: number };

/** Gold wireframe solids (the proof's lattice) that drift past at the edges of the view. */
function Lattices({ count, travel }: { count: number; travel: { current: number } }) {
  const group = useRef<THREE.Group>(null);
  const lattices = useMemo<Lattice[]>(() => {
    const shapes = [
      () => new THREE.IcosahedronGeometry(1.6, 0),
      () => new THREE.OctahedronGeometry(1.5, 0),
      () => new THREE.DodecahedronGeometry(1.4, 0),
    ];
    return Array.from({ length: count }, (_, index) => {
      const solid = shapes[index % shapes.length]();
      const geometry = new THREE.EdgesGeometry(solid);
      solid.dispose();
      const side = index % 2 ? 1 : -1;
      return {
        geometry,
        x: side * (13 + Math.random() * 9),
        y: -2 + Math.random() * 9,
        z: -(index / count) * DEPTH,
        spin: 0.15 + Math.random() * 0.25,
        bob: Math.random() * Math.PI * 2,
      };
    });
  }, [count]);

  useEffect(() => () => lattices.forEach((lattice) => lattice.geometry.dispose()), [lattices]);

  const screen = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, delta) => {
    const node = group.current;
    if (!node) return;
    const time = state.clock.elapsedTime;
    const { smoothstep } = THREE.MathUtils;
    node.children.forEach((child, index) => {
      const lattice = lattices[index];
      const z = ((((lattice.z + time * 1.4 + travel.current) % DEPTH) + DEPTH) % DEPTH) - DEPTH;
      child.position.set(lattice.x, lattice.y + Math.sin(time * 0.5 + lattice.bob) * 0.6, z);
      child.rotation.x += delta * lattice.spin;
      child.rotation.y += delta * lattice.spin * 0.7;
      // Fade with depth, and show only where the solid lands in the outer bands of the screen, so
      // it never drifts behind the page's text, whatever the viewport's shape.
      const near = 1 + z / DEPTH;
      const edge = Math.abs(screen.copy(child.position).project(state.camera).x);
      const line = child as THREE.LineSegments<THREE.EdgesGeometry, THREE.LineBasicMaterial>;
      const depth = smoothstep(near, 0.3, 0.5) * (1 - smoothstep(near, 0.9, 1));
      line.material.opacity = depth * smoothstep(edge, 0.62, 0.82) * 0.34;
    });
  });

  return (
    <group ref={group}>
      {lattices.map((lattice, index) => (
        <lineSegments key={index} geometry={lattice.geometry}>
          <lineBasicMaterial color={index % 3 === 2 ? ANON : GOLD} transparent opacity={0} depthWrite={false} />
        </lineSegments>
      ))}
    </group>
  );
}

function World({ quality, onFps, onReady }: Pick<Props, "onFps" | "onReady"> & { quality: typeof LEAN }) {
  const aim = useRef({ x: 0, y: 0 });
  const scroll = useRef(0);
  const travel = useRef(0);
  const started = useRef(false);
  const sample = useMemo(() => createFpsSampler(onFps), [onFps]);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      aim.current = { x: (event.clientX / window.innerWidth) * 2 - 1, y: (event.clientY / window.innerHeight) * 2 - 1 };
    };
    const onScroll = () => {
      scroll.current = window.scrollY;
    };
    onScroll();
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  useFrame((state, delta) => {
    // Scrolling flies forward through the field; the pointer tilts the view a little.
    travel.current += (scroll.current * 0.03 - travel.current) * 0.06;
    const camera = state.camera;
    camera.position.x += (aim.current.x * 1.4 - camera.position.x) * 0.04;
    camera.position.y += (-aim.current.y * 0.9 - camera.position.y) * 0.04;
    camera.lookAt(0, -1, -40);

    if (!started.current) {
      started.current = true;
      onReady();
    }
    // Sustained frame rate for the tier step-down (lib/fx/fps.ts).
    sample(delta);
  });

  return (
    <>
      <Floor travel={travel} />
      <Stars count={quality.stars} travel={travel} />
      <Lattices count={quality.lattices} travel={travel} />
    </>
  );
}

/** Tiers 2 and 3: the landing page's WebGL backdrop. Loaded on demand; never imported by app routes. */
export default function BackdropScene({ tier, lean, active, onFps, onLost, onReady }: Props) {
  const quality = lean ? LEAN : QUALITY[tier];
  const [warm, setWarm] = useState(false);
  const onWarm = useCallback(() => setWarm(true), []);
  const stopWatching = useRef<(() => void) | null>(null);
  useEffect(() => () => stopWatching.current?.(), []);
  return (
    <Canvas
      aria-hidden="true"
      dpr={quality.dpr}
      frameloop={active && warm ? "always" : "never"}
      camera={{ position: [0, 0, 0], fov: 60, near: 0.1, far: DEPTH + 20 }}
      gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
      style={{ position: "absolute", inset: 0 }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
        // A lost context gets a few seconds to come back before the scene falls back.
        stopWatching.current = watchContextLoss(gl.domElement, onLost);
      }}
    >
      <World quality={quality} onFps={onFps} onReady={onReady} />
      <Warmup onWarm={onWarm} />
    </Canvas>
  );
}
