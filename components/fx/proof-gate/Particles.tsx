"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ANON, GOLD, IDENTITY } from "@/components/fx/proof-gate/layout";

export type Flow = {
  startX: number;
  endX: number;
  gateX: number;
  gateY: number;
  gateR: number;
  spreadTop: number;
  spreadBottom: number;
  laneStart: number;
  lanes: number[];
};

export type Pointer = { x: number; y: number; on: number };

const vertex = /* glsl */ `
  attribute float aSeed;
  attribute float aSpeed;
  attribute float aY0;
  attribute float aOffset;
  attribute float aLane;
  attribute vec3 aColor;
  uniform float uTime;
  uniform float uEcho;
  uniform float uStartX;
  uniform float uEndX;
  uniform float uGateX;
  uniform float uGateY;
  uniform float uGateR;
  uniform float uSpreadTop;
  uniform float uSpreadBottom;
  uniform float uLaneStart;
  uniform float uLanes[5];
  uniform vec3 uPointer;
  uniform vec3 uGold;
  uniform vec3 uAnon;
  uniform float uSize;
  uniform float uPixelRatio;
  varying vec3 vColor;
  varying float vAlpha;

  float laneY(float lane) {
    if (lane < 0.5) return uLanes[0];
    if (lane < 1.5) return uLanes[1];
    if (lane < 2.5) return uLanes[2];
    if (lane < 3.5) return uLanes[3];
    return uLanes[4];
  }

  void main() {
    float t = fract(aSpeed * (uTime - uEcho) + aSeed);
    float x = mix(uStartX, uEndX, t);
    float wander = mix(uSpreadBottom, uSpreadTop, aY0) + sin(uTime * 0.7 + aSeed * 31.0) * 0.05;
    vec2 away = vec2(x, wander) - uPointer.xy;
    float near = length(away);
    wander += (away.y / max(near, 0.001)) * max(0.0, 0.9 - near) * 0.7 * uPointer.z;

    float gateY = uGateY + aOffset * uGateR * 0.65;
    float funnel = smoothstep(uGateX - uGateR * 6.0, uGateX - uGateR * 0.4, x);
    float before = mix(wander, gateY, funnel);
    float settle = smoothstep(uGateX, uLaneStart + uGateR, x);
    float after = mix(gateY, laneY(aLane), settle);
    float passed = step(uGateX, x);
    float y = mix(before, after, passed);

    float flash = 1.0 - smoothstep(0.0, uGateR * 0.45, abs(x - uGateX));
    vColor = mix(mix(aColor, uAnon, passed), uGold, flash);
    vAlpha = smoothstep(0.0, 0.03, t) * (1.0 - smoothstep(uEndX - uGateR * 0.6, uEndX, x));

    vec4 view = modelViewMatrix * vec4(x, y, position.z, 1.0);
    gl_Position = projectionMatrix * view;
    gl_PointSize = uSize * (mix(1.0, 0.72, passed) + flash * 0.9) * uPixelRatio * (10.0 / -view.z);
  }
`;

const fragment = /* glsl */ `
  uniform float uAlpha;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.05, d) * vAlpha * uAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor, a);
  }
`;

/**
 * Requests as GPU points: identity colours before the gate, a gold flash in it, white after.
 * Positions live in the vertex shader; the CPU only advances time and counts gate crossings.
 * `echoes` draws fainter copies slightly behind in time, as trails.
 */
export function Particles({
  flow,
  count,
  echoes,
  pointer,
  onCross,
}: {
  flow: Flow;
  count: number;
  echoes: number;
  pointer: RefObject<Pointer>;
  onCross: (crossed: number) => void;
}) {
  const geometry = useMemo(() => {
    const seed = new Float32Array(count);
    const speed = new Float32Array(count);
    const y0 = new Float32Array(count);
    const offset = new Float32Array(count);
    const lane = new Float32Array(count);
    const color = new Float32Array(count * 3);
    const depth = new Float32Array(count * 3);
    const tint = new THREE.Color();
    for (let index = 0; index < count; index += 1) {
      seed[index] = Math.random();
      speed[index] = 0.07 + Math.random() * 0.07;
      y0[index] = Math.random();
      offset[index] = Math.random() * 2 - 1;
      lane[index] = Math.floor(Math.random() * 5);
      tint.set(IDENTITY[index % IDENTITY.length]);
      color.set([tint.r, tint.g, tint.b], index * 3);
      depth[index * 3 + 2] = (Math.random() - 0.5) * 0.8;
    }
    const built = new THREE.BufferGeometry();
    built.setAttribute("position", new THREE.BufferAttribute(depth, 3));
    built.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    built.setAttribute("aSpeed", new THREE.BufferAttribute(speed, 1));
    built.setAttribute("aY0", new THREE.BufferAttribute(y0, 1));
    built.setAttribute("aOffset", new THREE.BufferAttribute(offset, 1));
    built.setAttribute("aLane", new THREE.BufferAttribute(lane, 1));
    built.setAttribute("aColor", new THREE.BufferAttribute(color, 3));
    built.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
    return built;
  }, [count]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  const layers = useMemo(
    () =>
      Array.from({ length: echoes + 1 }, (_, layer) => ({
        uTime: { value: 0 },
        uEcho: { value: layer * 0.05 },
        uAlpha: { value: layer === 0 ? 0.95 : 0.32 / layer },
        uStartX: { value: 0 },
        uEndX: { value: 0 },
        uGateX: { value: 0 },
        uGateY: { value: 0 },
        uGateR: { value: 1 },
        uSpreadTop: { value: 0 },
        uSpreadBottom: { value: 0 },
        uLaneStart: { value: 0 },
        uLanes: { value: [0, 0, 0, 0, 0] },
        uPointer: { value: new THREE.Vector3() },
        uGold: { value: new THREE.Color(GOLD) },
        uAnon: { value: new THREE.Color(ANON) },
        uSize: { value: 6 },
        uPixelRatio: { value: 1 },
      })),
    [echoes],
  );

  const last = useRef(-1);

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    const { x, y, on } = pointer.current ?? { x: 0, y: 0, on: 0 };
    for (const uniforms of layers) {
      uniforms.uTime.value = time;
      uniforms.uStartX.value = flow.startX;
      uniforms.uEndX.value = flow.endX;
      uniforms.uGateX.value = flow.gateX;
      uniforms.uGateY.value = flow.gateY;
      uniforms.uGateR.value = flow.gateR;
      uniforms.uSpreadTop.value = flow.spreadTop;
      uniforms.uSpreadBottom.value = flow.spreadBottom;
      uniforms.uLaneStart.value = flow.laneStart;
      uniforms.uLanes.value = flow.lanes;
      uniforms.uPointer.value.set(x, y, on);
      uniforms.uPixelRatio.value = state.gl.getPixelRatio();
    }
    // Count the requests that crossed the gate since the last frame, with the shader's own maths.
    const previous = last.current;
    last.current = time;
    if (previous < 0) return;
    const gateT = (flow.gateX - flow.startX) / (flow.endX - flow.startX);
    const speed = geometry.getAttribute("aSpeed").array as Float32Array;
    const seed = geometry.getAttribute("aSeed").array as Float32Array;
    let crossed = 0;
    for (let index = 0; index < count; index += 1) {
      const before = (speed[index] * previous + seed[index]) % 1;
      const now = (speed[index] * time + seed[index]) % 1;
      if (now >= before ? before < gateT && now >= gateT : before < gateT || now >= gateT) crossed += 1;
    }
    if (crossed) onCross(crossed);
  });

  return (
    <>
      {layers.map((uniforms, layer) => (
        <points key={layer} geometry={geometry} frustumCulled={false} renderOrder={2 - layer}>
          <shaderMaterial
            uniforms={uniforms}
            vertexShader={vertex}
            fragmentShader={fragment}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </points>
      ))}
    </>
  );
}
