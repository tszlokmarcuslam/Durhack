import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, RoundedBox } from '@react-three/drei';
import { Color, Shape, Vector3, type Group } from 'three';
import { useCompanionStore } from '../store/companionStore';
import { usePetStore, type Expression } from '../store/petStore';
import { playerState } from './playerState';

const target = new Vector3();
const FACE_Z = 0.262; // just in front of the visor

/** Glowing face parts are unlit so they read as a screen, like the reference. */
function Glow({ color }: { color: string }) {
  return <meshBasicMaterial color={color} toneMapped={false} />;
}

/** Glossy shell; a little self-glow keeps light colours from going grey on the shaded side. */
function Shell({ color }: { color: string }) {
  return <meshPhysicalMaterial color={color} emissive={color} emissiveIntensity={0.18} roughness={0.25} clearcoat={1} />;
}

function heartShape() {
  const s = new Shape();
  s.moveTo(0, -0.04);
  s.bezierCurveTo(-0.07, 0.0, -0.045, 0.06, 0, 0.025);
  s.bezierCurveTo(0.045, 0.06, 0.07, 0.0, 0, -0.04);
  return s;
}

function Eye({ kind, color, heart }: { kind: Expression | 'line' | 'arc'; color: string; heart: Shape }) {
  switch (kind) {
    case 'happy':
    case 'arc':
      return (
        <mesh>
          <torusGeometry args={[0.045, 0.014, 8, 20, Math.PI]} />
          <Glow color={color} />
        </mesh>
      );
    case 'surprised':
      return (
        <mesh>
          <circleGeometry args={[0.06, 24]} />
          <Glow color={color} />
        </mesh>
      );
    case 'sleepy':
    case 'line':
      return (
        <mesh>
          <planeGeometry args={[0.09, 0.016]} />
          <Glow color={color} />
        </mesh>
      );
    case 'love':
      return (
        <mesh scale={1.1}>
          <shapeGeometry args={[heart]} />
          <Glow color={color} />
        </mesh>
      );
    default:
      return (
        <mesh scale={[1, 1.3, 1]}>
          <circleGeometry args={[0.042, 20]} />
          <Glow color={color} />
        </mesh>
      );
  }
}

function Mouth({ expression, color }: { expression: Expression; color: string }) {
  if (expression === 'surprised') {
    return (
      <mesh>
        <torusGeometry args={[0.026, 0.01, 8, 20]} />
        <Glow color={color} />
      </mesh>
    );
  }
  if (expression === 'neutral' || expression === 'sleepy') {
    return (
      <mesh>
        <planeGeometry args={[expression === 'sleepy' ? 0.03 : 0.06, 0.014]} />
        <Glow color={color} />
      </mesh>
    );
  }
  // filled half-moon smile
  return (
    <mesh position={[0, 0.012, 0]}>
      <circleGeometry args={[0.034, 20, Math.PI, Math.PI]} />
      <Glow color={color} />
    </mesh>
  );
}

const BUBBLE_CHARS = 220;

/** What the robot says: "…" while thinking, then the latest reply for a while, else a tap prompt. */
function useBubble() {
  const thinking = useCompanionStore((s) => s.status === 'thinking');
  const chatOpen = useCompanionStore((s) => s.chatOpen);
  const last = useCompanionStore((s) => s.messages[s.messages.length - 1]);
  const [visibleId, setVisibleId] = useState<number | null>(null);

  useEffect(() => {
    if (last?.role !== 'assistant') return;
    setVisibleId(last.id);
    const ms = Math.min(15_000, 4000 + last.text.length * 60); // longer replies stay up longer
    const timer = setTimeout(() => setVisibleId(null), ms);
    return () => clearTimeout(timer);
  }, [last]);

  if (thinking) return '…';
  if (last?.role === 'assistant' && last.id === visibleId) {
    return last.text.length > BUBBLE_CHARS ? `${last.text.slice(0, BUBBLE_CHARS)}…` : last.text;
  }
  return chatOpen ? null : '💬 Tap to chat';
}

export function Pet() {
  const root = useRef<Group>(null);
  const body = useRef<Group>(null);
  const head = useRef<Group>(null);
  const eyes = useRef<Group>(null);
  const mouth = useRef<Group>(null);
  const armL = useRef<Group>(null);
  const armR = useRef<Group>(null);
  const earL = useRef<Group>(null);
  const earR = useRef<Group>(null);
  const blinkAt = useRef(2);
  const twitchAt = useRef(4);

  const { bodyColor, glowColor, expression } = usePetStore();
  const thinking = useCompanionStore((s) => s.status === 'thinking');
  const speaking = useCompanionStore((s) => s.speaking);
  const setChatOpen = useCompanionStore((s) => s.setChatOpen);
  const bubble = useBubble();
  const heart = useMemo(heartShape, []);
  const trim = useMemo(() => `#${new Color(bodyColor).multiplyScalar(0.82).getHexString()}`, [bodyColor]);

  useFrame(({ clock, camera }, dt) => {
    const g = root.current;
    if (!g) return;
    const t = clock.elapsedTime;

    // Float beside the player's right shoulder, easing towards it.
    const h = playerState.heading;
    target.set(
      playerState.position.x - Math.sin(h) * 0.9 + Math.cos(h) * 1.0,
      0,
      playerState.position.z - Math.cos(h) * 0.9 - Math.sin(h) * 1.0,
    );
    const ease = 1 - Math.exp(-3.5 * dt);
    g.position.x += (target.x - g.position.x) * ease;
    g.position.z += (target.z - g.position.z) * ease;
    g.position.y = 1.35 + Math.sin(t * 2) * 0.08;

    // Turn to face the camera so the player sees the face.
    const face = Math.atan2(camera.position.x - g.position.x, camera.position.z - g.position.z);
    const turn = Math.atan2(Math.sin(face - g.rotation.y), Math.cos(face - g.rotation.y));
    g.rotation.y += turn * Math.min(1, dt * 5);

    // Idle: gentle sway, swinging arms, head tilt while thinking.
    if (body.current) body.current.rotation.z = Math.sin(t * 1.3) * 0.05;
    if (head.current) {
      const tilt = thinking ? 0.22 : Math.sin(t * 0.9) * 0.06;
      head.current.rotation.z += (tilt - head.current.rotation.z) * Math.min(1, dt * 6);
      head.current.rotation.x = Math.sin(t * 1.1) * 0.04;
    }
    if (armL.current) armL.current.rotation.z = 0.25 + Math.sin(t * 2) * 0.12;
    if (armR.current) armR.current.rotation.z = -0.25 - Math.sin(t * 2 + 0.6) * 0.12;

    // Blink every few seconds.
    if (t > blinkAt.current + 0.13) blinkAt.current = t + 2.5 + Math.random() * 3;
    if (eyes.current) eyes.current.scale.y = t > blinkAt.current ? 0.1 : 1;

    // Occasional ear twitch.
    if (t > twitchAt.current + 0.3) twitchAt.current = t + 3 + Math.random() * 5;
    const twitch = t > twitchAt.current ? Math.sin((t - twitchAt.current) * 30) * 0.15 : 0;
    if (earL.current) earL.current.rotation.z = 0.35 + twitch;
    if (earR.current) earR.current.rotation.z = -0.35;

    // Mouth moves while the voice plays.
    if (mouth.current) mouth.current.scale.y = speaking ? 0.6 + Math.abs(Math.sin(t * 14)) * 0.9 : 1;
  });

  const rightEye: Expression | 'line' = expression === 'wink' ? 'line' : expression;
  const leftEye: Expression | 'arc' = expression === 'wink' ? 'arc' : expression;

  return (
    <group ref={root} position={[1, 1.35, -0.9]}>
      <group ref={body} scale={1.25}>
        {/* egg body with a panel seam */}
        <mesh position={[0, -0.12, 0]} scale={[1, 1.15, 0.95]} castShadow>
          <sphereGeometry args={[0.28, 32, 24]} />
          <Shell color={bodyColor} />
        </mesh>
        <mesh position={[0, -0.14, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 0.95, 1]}>
          <torusGeometry args={[0.272, 0.005, 6, 40]} />
          <meshStandardMaterial color={trim} />
        </mesh>

        {/* floating arms */}
        <group ref={armL} position={[-0.36, -0.06, 0]}>
          <mesh position={[0, -0.1, 0]} scale={[0.6, 1.5, 0.6]} castShadow>
            <sphereGeometry args={[0.1, 16, 12]} />
            <Shell color={bodyColor} />
          </mesh>
        </group>
        <group ref={armR} position={[0.36, -0.06, 0]}>
          <mesh position={[0, -0.1, 0]} scale={[0.6, 1.5, 0.6]} castShadow>
            <sphereGeometry args={[0.1, 16, 12]} />
            <Shell color={bodyColor} />
          </mesh>
        </group>

        <group ref={head} position={[0, 0.3, 0]}>
          <RoundedBox args={[0.62, 0.46, 0.48]} radius={0.15} smoothness={4} castShadow>
            <Shell color={bodyColor} />
          </RoundedBox>
          {/* dark visor */}
          <RoundedBox args={[0.5, 0.32, 0.12]} radius={0.055} smoothness={4} position={[0, -0.01, 0.2]}>
            <meshPhysicalMaterial color="#0b1220" roughness={0.15} clearcoat={1} />
          </RoundedBox>

          <group ref={eyes} position={[0, 0.03, FACE_Z]}>
            <group position={[-0.11, 0, 0]}>
              <Eye kind={leftEye} color={glowColor} heart={heart} />
            </group>
            <group position={[0.11, 0, 0]}>
              <Eye kind={rightEye} color={glowColor} heart={heart} />
            </group>
          </group>
          <group ref={mouth} position={[0, -0.07, FACE_Z]}>
            <Mouth expression={expression} color={glowColor} />
          </group>

          {/* headphone discs */}
          {[-1, 1].map((side) => (
            <group key={side} position={[side * 0.31, -0.02, 0]} rotation={[0, 0, Math.PI / 2]}>
              <mesh>
                <cylinderGeometry args={[0.1, 0.1, 0.06, 24]} />
                <meshPhysicalMaterial color={trim} roughness={0.3} clearcoat={1} />
              </mesh>
              <mesh position={[0, side * 0.032, 0]}>
                <cylinderGeometry args={[0.05, 0.05, 0.01, 20]} />
                <Glow color={glowColor} />
              </mesh>
            </group>
          ))}

          {/* robotic cat ears: pointed panels with a glowing inner face */}
          {[-1, 1].map((side) => (
            <group key={side} ref={side < 0 ? earL : earR} position={[side * 0.17, 0.22, -0.02]} rotation={[0, 0, -side * 0.35]}>
              <mesh position={[0, 0.08, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
                <coneGeometry args={[0.1, 0.19, 4]} />
                <Shell color={bodyColor} />
              </mesh>
              <mesh position={[0, 0.07, 0.04]} rotation={[0, Math.PI / 4, 0]} scale={[0.55, 0.65, 0.55]}>
                <coneGeometry args={[0.1, 0.19, 4]} />
                <Glow color={glowColor} />
              </mesh>
            </group>
          ))}
        </group>
      </group>

      {bubble && (
        <Html position={[0, 0.85, 0]} center distanceFactor={10} zIndexRange={[10, 0]}>
          <button
            type="button"
            onClick={() => setChatOpen(true)}
            aria-label={`Echo says: ${bubble}. Open chat`}
            className="relative block w-max max-w-64 cursor-pointer rounded-2xl bg-white px-3 py-1.5 text-left text-sm text-slate-800 shadow-lg transition hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          >
            {bubble}
            <span className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 bg-white" aria-hidden />
          </button>
        </Html>
      )}
    </group>
  );
}
