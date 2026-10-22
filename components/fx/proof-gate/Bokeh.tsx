"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { IDENTITY } from "@/components/fx/proof-gate/layout";
import type { Flow } from "@/components/fx/proof-gate/Particles";

const vertex = /* glsl */ `
  attribute float aSeed;
  attribute float aSpeed;
  attribute float aY;
  attribute float aSize;
  attribute vec3 aColor;
  uniform float uTime;
  uniform float uStartX;
  uniform float uEndX;
  uniform float uTop;
  uniform float uBottom;
  uniform float uPixelRatio;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float t = fract(aSpeed * uTime + aSeed);
    float x = mix(uStartX, uEndX, t);
    float y = mix(uBottom, uTop, aY) + sin(uTime * 0.3 + aSeed * 20.0) * 0.25;
    vColor = aColor;
    vAlpha = smoothstep(0.0, 0.18, t) * (1.0 - smoothstep(0.7, 1.0, t));
    gl_Position = projectionMatrix * modelViewMatrix * vec4(x, y, position.z, 1.0);
    gl_PointSize = aSize * uPixelRatio;
  }
`;

const fragment = /* glsl */ `
  uniform float uAlpha;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float a = exp(-dot(p, p) * 14.0) * vAlpha * uAlpha;
    if (a < 0.004) discard;
    gl_FragColor = vec4(vColor, a);
    #include <colorspace_fragment>
  }
`;

/**
 * Large, soft identity-coloured lights drifting through the incoming band, behind the requests.
 * They give the glass panels real colour to blur; tiny request points alone vanish under frost.
 */
export function Bokeh({ flow, count }: { flow: Flow; count: number }) {
  const material = useRef<THREE.ShaderMaterial>(null);
  const geometry = useMemo(() => {
    const seed = new Float32Array(count);
    const speed = new Float32Array(count);
    const y = new Float32Array(count);
    const size = new Float32Array(count);
    const color = new Float32Array(count * 3);
    const depth = new Float32Array(count * 3);
    const tint = new THREE.Color();
    for (let index = 0; index < count; index += 1) {
      seed[index] = index / count + Math.random() * 0.05;
      speed[index] = 0.018 + Math.random() * 0.02;
      y[index] = Math.random();
      size[index] = 120 + Math.random() * 110;
      tint.set(IDENTITY[index % IDENTITY.length]);
      color.set([tint.r, tint.g, tint.b], index * 3);
      depth[index * 3 + 2] = -0.6;
    }
    const built = new THREE.BufferGeometry();
    built.setAttribute("position", new THREE.BufferAttribute(depth, 3));
    built.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    built.setAttribute("aSpeed", new THREE.BufferAttribute(speed, 1));
    built.setAttribute("aY", new THREE.BufferAttribute(y, 1));
    built.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    built.setAttribute("aColor", new THREE.BufferAttribute(color, 3));
    return built;
  }, [count]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  // Initial values only: R3F copies uniforms into the material, so updates go through the ref.
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uStartX: { value: 0 },
      uEndX: { value: 0 },
      uTop: { value: 0 },
      uBottom: { value: 0 },
      uPixelRatio: { value: 1 },
      uAlpha: { value: 0.28 },
    }),
    [],
  );

  useFrame((state) => {
    const live = material.current?.uniforms;
    if (!live) return;
    live.uTime.value = state.clock.elapsedTime;
    live.uStartX.value = flow.startX;
    live.uEndX.value = flow.gateX - flow.gateR * 1.2;
    live.uTop.value = flow.spreadTop;
    live.uBottom.value = flow.spreadBottom;
    live.uPixelRatio.value = state.gl.getPixelRatio();
  });

  return (
    <points geometry={geometry} frustumCulled={false} renderOrder={0}>
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={vertex}
        fragmentShader={fragment}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
