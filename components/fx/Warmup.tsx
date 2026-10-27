"use client";

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";

/**
 * Compiles every shader in the scene with renderer.compileAsync (KHR_parallel_shader_compile where
 * available) before the first frame, so that frame doesn't block the main thread on synchronous
 * shader compilation. Render it last inside the Canvas, so the scene's objects (and an environment
 * map set in an earlier effect) are in place, and keep the frameloop at "never" until `onWarm`.
 * Only the lazily loaded WebGL chunks import it.
 */
export function Warmup({ onWarm }: { onWarm: () => void }) {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    let live = true;
    const done = () => live && onWarm();
    gl.compileAsync(scene, camera).then(done, done);
    return () => {
      live = false;
    };
  }, [gl, scene, camera, onWarm]);
  return null;
}
