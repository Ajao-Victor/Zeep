"use client";

import { useLayoutEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { GOLD } from "@/components/fx/proof-gate/layout";

const BARS = 48;

const horizonVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const horizonFragment = /* glsl */ `
  uniform float uTime;
  uniform float uEnergy;
  uniform vec3 uGold;
  varying vec2 vUv;
  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float d = length(p);
    float rim = smoothstep(0.45, 1.0, d) * (1.0 - smoothstep(0.97, 1.0, d));
    float swirl = sin(atan(p.y, p.x) * 6.0 + uTime * 0.6 - d * 12.0) * 0.5 + 0.5;
    float core = (1.0 - d) * 0.1;
    float a = rim * (0.28 + 0.45 * uEnergy) + swirl * rim * 0.16 + core * (0.5 + uEnergy);
    gl_FragColor = vec4(uGold, a);
    #include <colorspace_fragment>
  }
`;

/**
 * The proof gate: a gold ring with a lattice crown, a tilted second ring for depth, and a glowing
 * "event horizon" disc. `energy` (0..1+, written by the scene on hover and click) brightens it.
 */
export function Gate({ x, y, r, energy }: { x: number; y: number; r: number; energy: RefObject<number> }) {
  const group = useRef<THREE.Group>(null);
  const tilted = useRef<THREE.Mesh>(null);
  const bars = useRef<THREE.InstancedMesh>(null);
  const metal = useRef<THREE.MeshStandardMaterial>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uEnergy: { value: 0 }, uGold: { value: new THREE.Color(GOLD) } }), []);

  useLayoutEffect(() => {
    const mesh = bars.current;
    if (!mesh) return;
    const matrix = new THREE.Object3D();
    for (let index = 0; index < BARS; index += 1) {
      const angle = (index / BARS) * Math.PI * 2;
      const length = index % 2 ? 0.1 : 0.17;
      matrix.position.set(Math.cos(angle) * r * (1.06 + length / 2), Math.sin(angle) * r * (1.06 + length / 2), 0);
      matrix.rotation.set(0, 0, angle);
      matrix.scale.set(r * length, r * 0.014, r * 0.03);
      matrix.updateMatrix();
      mesh.setMatrixAt(index, matrix.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [r]);

  useFrame((state, delta) => {
    const level = energy.current ?? 0;
    uniforms.uTime.value = state.clock.elapsedTime;
    uniforms.uEnergy.value = level;
    if (group.current) group.current.rotation.z += delta * 0.08;
    if (tilted.current) tilted.current.rotation.y += delta * 0.35;
    if (metal.current) metal.current.emissiveIntensity = 0.12 + level * 0.55;
  });

  return (
    <group position={[x, y, 0]}>
      <group ref={group}>
        <mesh>
          <torusGeometry args={[r, r * 0.02, 16, 160]} />
          <meshStandardMaterial ref={metal} color={GOLD} emissive={GOLD} emissiveIntensity={0.12} metalness={0.9} roughness={0.28} />
        </mesh>
        <instancedMesh ref={bars} args={[undefined, undefined, BARS]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={GOLD} metalness={0.9} roughness={0.32} />
        </instancedMesh>
      </group>
      <mesh ref={tilted} rotation={[1.15, 0, 0]}>
        <torusGeometry args={[r * 1.14, r * 0.008, 8, 160]} />
        <meshStandardMaterial color="#8f6418" metalness={0.9} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0, -0.01]}>
        <circleGeometry args={[r * 0.96, 96]} />
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={horizonVertex}
          fragmentShader={horizonFragment}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}
