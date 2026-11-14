import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Vector3, type Group } from 'three';
import { useCompanionStore } from '../store/companionStore';
import { playerState } from './playerState';

const target = new Vector3();
const BUBBLE_MS = 7000;
const BUBBLE_CHARS = 90;

/** Shows "…" while thinking, then the latest reply for a few seconds. */
function useSpeechBubble(): string | null {
  const thinking = useCompanionStore((s) => s.status === 'thinking');
  const last = useCompanionStore((s) => s.messages[s.messages.length - 1]);
  const [visibleId, setVisibleId] = useState<number | null>(null);

  useEffect(() => {
    if (last?.role !== 'assistant') return;
    setVisibleId(last.id);
    const timer = setTimeout(() => setVisibleId(null), BUBBLE_MS);
    return () => clearTimeout(timer);
  }, [last]);

  if (thinking) return '…';
  if (last?.role === 'assistant' && last.id === visibleId) {
    return last.text.length > BUBBLE_CHARS ? `${last.text.slice(0, BUBBLE_CHARS)}…` : last.text;
  }
  return null;
}

export function Pet() {
  const group = useRef<Group>(null);
  const bubble = useSpeechBubble();

  useFrame(({ clock }, dt) => {
    const g = group.current;
    if (!g) return;
    // Trail behind the player's right shoulder.
    const h = playerState.heading;
    target.set(
      playerState.position.x - Math.sin(h) * 1.2 + Math.cos(h) * 0.8,
      0,
      playerState.position.z - Math.cos(h) * 1.2 - Math.sin(h) * 0.8,
    );
    const dx = target.x - g.position.x;
    const dz = target.z - g.position.z;
    const ease = 1 - Math.exp(-4 * dt);
    g.position.x += dx * ease;
    g.position.z += dz * ease;
    g.position.y = 0.55 + Math.sin(clock.elapsedTime * 3) * 0.08; // idle bob
    if (dx * dx + dz * dz > 0.01) g.rotation.y = Math.atan2(dx, dz);
  });

  return (
    <group ref={group} position={[0.8, 0.55, -1.2]}>
      <mesh castShadow>
        <sphereGeometry args={[0.28, 16, 16]} />
        <meshStandardMaterial color="#34d399" />
      </mesh>
      {[-0.15, 0.15].map((x) => (
        <mesh key={x} position={[x, 0.26, 0]}>
          <coneGeometry args={[0.08, 0.2, 8]} />
          <meshStandardMaterial color="#10b981" />
        </mesh>
      ))}
      {[-0.1, 0.1].map((x) => (
        <mesh key={x} position={[x, 0.05, 0.25]}>
          <sphereGeometry args={[0.04, 8, 8]} />
          <meshStandardMaterial color="#0f172a" />
        </mesh>
      ))}
      {bubble && (
        <Html position={[0, 0.75, 0]} center distanceFactor={10} zIndexRange={[10, 0]}>
          <p className="pointer-events-none w-max max-w-56 select-none rounded-xl bg-white px-3 py-1.5 text-sm text-slate-800 shadow">
            {bubble}
          </p>
        </Html>
      )}
    </group>
  );
}
