import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import { CanvasTexture, SRGBColorSpace, type Group } from 'three';

export const WRITE_CHARS_PER_SECOND = 14;
const W = 512;
const H = 352;

/** Seconds needed to write all lines at the robot's writing speed. */
export const writeSeconds = (lines: string[]) => lines.join('').length / WRITE_CHARS_PER_SECOND;

/**
 * A small handheld whiteboard the robot writes on, revealing its lines character by character.
 * It is a prop for the animation: the player doesn't need to read it.
 */
export function HandBoard({ lines, startedAt }: { lines: string[]; startedAt: number }) {
  const group = useRef<Group>(null);
  const shown = useRef(-1);
  const { canvas, texture } = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    return { canvas, texture };
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);

  useFrame((_, dt) => {
    const g = group.current;
    if (g) g.scale.setScalar(Math.min(1, g.scale.x + dt * 5)); // pop in
    const total = lines.join('').length;
    const chars = Math.min(total, Math.floor(((performance.now() - startedAt) / 1000) * WRITE_CHARS_PER_SECOND));
    if (chars === shown.current) return;
    shown.current = chars;

    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    ctx.font = 'bold 48px "Segoe Print", "Comic Sans MS", "Chalkboard SE", cursive';
    ctx.fillStyle = '#1e3a8a';
    ctx.textBaseline = 'middle';
    let left = chars;
    const step = H / (lines.length + 1);
    lines.forEach((line, i) => {
      if (left <= 0) return;
      const text = line.slice(0, left);
      left -= line.length;
      const scale = Math.min(1, (W - 40) / Math.max(ctx.measureText(text).width, 1)); // always fit
      ctx.save();
      ctx.translate(20, step * (i + 1));
      ctx.scale(scale, scale);
      ctx.fillText(text, 0, 0);
      ctx.restore();
    });
    texture.needsUpdate = true;
  });

  return (
    <group ref={group} scale={0.01}>
      <RoundedBox args={[0.34, 0.24, 0.02]} radius={0.008} smoothness={2} castShadow>
        <meshStandardMaterial color="#94a3b8" roughness={0.7} />
      </RoundedBox>
      <mesh position={[0, 0, 0.011]}>
        <planeGeometry args={[0.32, 0.22]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
    </group>
  );
}
