"use client";

import { ANON } from "@/components/fx/proof-gate/layout";

/**
 * The service lanes after the gate (one per entry in LANES), each ending at a thin glass
 * monolith. `px` is one CSS pixel in world units, so hairlines stay one pixel at any size.
 * Labels are DOM, not 3D text.
 */
export function Lanes({ lanes, start, end, px }: { lanes: number[]; start: number; end: number; px: number }) {
  const length = Math.max(0, end - start);
  return (
    <group>
      {lanes.map((y) => (
        <group key={y}>
          <mesh position={[start + length / 2, y, -0.05]}>
            <planeGeometry args={[length, px]} />
            <meshBasicMaterial color="#2e2c28" />
          </mesh>
          <mesh position={[end + px * 5, y, 0]}>
            <boxGeometry args={[px * 5, px * 22, 0.18]} />
            <meshStandardMaterial color="#1c1b18" emissive={ANON} emissiveIntensity={0.05} metalness={0.6} roughness={0.22} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
