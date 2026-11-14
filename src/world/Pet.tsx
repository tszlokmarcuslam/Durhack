import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, RoundedBox } from '@react-three/drei';
import { Color, Shape, Vector3, type Group, type Mesh } from 'three';
import { useCompanionStore, type ChatMessage } from '../store/companionStore';
import { usePetStore } from '../store/petStore';
import type { Expression } from '../types/companion';
import { playerState } from './playerState';
import { HandBoard, writeSeconds } from './Whiteboard';

/** Reply moods plus the robot's own states. */
type Face = Expression | 'sleepy' | 'thinking';

const FACE_Z = 0.262; // just in front of the visor
const SLEEP_AFTER_S = 45;
const BUBBLE_CHARS = 220;

// Arm poses as [rotation.x, rotation.z]. side is -1 / 1; z = side * angle swings an arm outward.
// rotation.x < 0 swings the arm forward.
const GESTURES = ['swing', 'open', 'point', 'beat', 'wave', 'swing', 'beat'] as const;
type Gesture = (typeof GESTURES)[number];
const GESTURE_SECONDS = 1.8;

function gesturePose(g: Gesture, side: -1 | 1, t: number): [number, number] {
  switch (g) {
    case 'swing': // arms swing back and forth in opposition, like explaining while moving
      return [Math.sin(t * 4 + (side > 0 ? Math.PI : 0)) * 0.7, side * 0.15];
    case 'open': // "ta-da": both arms spread wide and lifted
      return [-0.3, side * (1.0 + Math.sin(t * 5) * 0.1)];
    case 'point': // one arm points ahead, the other relaxes
      return side > 0 ? [-1.4 + Math.sin(t * 6) * 0.08, side * 0.1] : [0.15, side * 0.15];
    case 'beat': // both hands forward, bobbing on each phrase
      return [-0.8 - Math.abs(Math.sin(t * 6)) * 0.35, side * 0.25];
    case 'wave': // one arm up, waving
      return side > 0 ? [0, side * (2.3 + Math.sin(t * 10) * 0.3)] : [0.1, side * 0.15];
  }
}

function writingPose(side: -1 | 1, t: number): [number, number] {
  // the left hand holds the board, the right one scribbles across it
  return side < 0 ? [-1.05, 0.6] : [-1.15 + Math.sin(t * 18) * 0.1, -0.8 + Math.sin(t * 9) * 0.15];
}
const target = new Vector3();

/** Glowing face parts are unlit so they read as a screen, like the reference. */
function Glow({ color }: { color: string }) {
  return <meshBasicMaterial color={color} toneMapped={false} />;
}

/** Soft matte plastic shell; a little self-glow keeps light colours from going grey on the shaded side. */
function Shell({ color }: { color: string }) {
  return <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.18} roughness={0.75} metalness={0} />;
}

/** Rounded cat ear: a smooth cone whose tip is capped by a sphere, flattened into a panel. */
function Ear({ children }: { children: React.ReactNode }) {
  return (
    <>
      <mesh position={[0, 0.07, 0]} castShadow>
        <coneGeometry args={[0.11, 0.14, 24]} />
        {children}
      </mesh>
      {/* sphere sits tangent to the cone sides, so the tip is fully rounded */}
      <mesh position={[0, 0.06, 0]}>
        <sphereGeometry args={[0.062, 20, 14]} />
        {children}
      </mesh>
    </>
  );
}

function heartShape() {
  const s = new Shape();
  s.moveTo(0, -0.04);
  s.bezierCurveTo(-0.07, 0.0, -0.045, 0.06, 0, 0.025);
  s.bezierCurveTo(0.045, 0.06, 0.07, 0.0, 0, -0.04);
  return s;
}

type EyeKind = Face | 'line' | 'arc';

function Eye({ kind, side, color, heart }: { kind: EyeKind; side: -1 | 1; color: string; heart: Shape }) {
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
    case 'sad':
      // small eyes under brows that droop towards the outside
      return (
        <>
          <mesh scale={[1, 1.2, 1]} position={[0, -0.01, 0]}>
            <circleGeometry args={[0.034, 20]} />
            <Glow color={color} />
          </mesh>
          <mesh position={[0, 0.055, 0]} rotation={[0, 0, side * -0.4]}>
            <planeGeometry args={[0.08, 0.014]} />
            <Glow color={color} />
          </mesh>
        </>
      );
    case 'thinking':
      // looking up and to the side
      return (
        <mesh scale={[1, 1.3, 1]} position={[0.015, 0.025, 0]}>
          <circleGeometry args={[0.036, 20]} />
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

function Mouth({ face, color }: { face: Face; color: string }) {
  if (face === 'surprised') {
    return (
      <mesh>
        <torusGeometry args={[0.026, 0.01, 8, 20]} />
        <Glow color={color} />
      </mesh>
    );
  }
  if (face === 'sad') {
    // filled frown
    return (
      <mesh position={[0, -0.018, 0]}>
        <circleGeometry args={[0.03, 20, 0, Math.PI]} />
        <Glow color={color} />
      </mesh>
    );
  }
  if (face === 'neutral' || face === 'sleepy' || face === 'thinking') {
    return (
      <mesh position={[face === 'thinking' ? 0.02 : 0, 0, 0]}>
        <planeGeometry args={[face === 'neutral' ? 0.06 : 0.03, 0.014]} />
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

/**
 * The reply the robot is currently performing (bubble, face, board, flight), or null.
 * With voice on, the performance ends shortly after the audio does; without voice (or if it fails),
 * it lasts roughly as long as the reply takes to read.
 */
function useOnStage(speaking: boolean): ChatMessage | null {
  const last = useCompanionStore((s) => s.messages[s.messages.length - 1]);
  const [onStage, setOnStage] = useState<ChatMessage | null>(null);
  const heard = useRef(false);
  const startedAt = useRef(0);

  useEffect(() => {
    if (last?.role !== 'assistant') return setOnStage(null);
    setOnStage(last);
    heard.current = false;
    startedAt.current = performance.now();
    const readMs = Math.max(Math.min(15_000, 4000 + last.text.length * 60), writeSeconds(last.board ?? []) * 1000 + 1500);
    const timer = setTimeout(() => !heard.current && setOnStage(null), readMs);
    return () => clearTimeout(timer);
  }, [last]);

  useEffect(() => {
    if (speaking) {
      heard.current = true;
      return;
    }
    if (!heard.current || !onStage) return;
    // Wrap up just after the voice stops, but let any writing finish first.
    const writeEnd = startedAt.current + writeSeconds(onStage.board ?? []) * 1000;
    const timer = setTimeout(() => setOnStage(null), Math.max(500, writeEnd - performance.now()));
    return () => clearTimeout(timer);
  }, [speaking, onStage]);

  return onStage;
}

const SPARKS = 24;

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
  const sparkMeshes = useRef<(Mesh | null)[]>([]);
  const sparks = useRef(Array.from({ length: SPARKS }, () => ({ life: 0, x: 0, y: 0, z: 0 })));
  const nextSpark = useRef(0);
  const sparkClock = useRef(0);
  const blinkAt = useRef(2);
  const twitchAt = useRef(4);
  const flight = useRef(0);
  const velocity = useRef(new Vector3());
  const lastActive = useRef(0);

  const { bodyColor, glowColor } = usePetStore();
  const thinking = useCompanionStore((s) => s.status === 'thinking');
  const failed = useCompanionStore((s) => s.error !== null);
  const speaking = useCompanionStore((s) => s.speaking);
  const chatOpen = useCompanionStore((s) => s.chatOpen);
  const setChatOpen = useCompanionStore((s) => s.setChatOpen);
  const onStage = useOnStage(speaking);
  const [sleepy, setSleepy] = useState(false);
  const [boardStart, setBoardStart] = useState(0);

  const heart = useMemo(heartShape, []);
  const trim = useMemo(() => `#${new Color(bodyColor).multiplyScalar(0.82).getHexString()}`, [bodyColor]);
  const lid = useMemo(() => `#${new Color(bodyColor).multiplyScalar(0.86).getHexString()}`, [bodyColor]);

  const boardLines = onStage?.board?.length ? onStage.board : null;
  const [boardOut, setBoardOut] = useState(false);
  // Take the board out, write, then put it away a moment after the last character.
  useEffect(() => {
    setBoardStart(performance.now());
    setBoardOut(boardLines !== null);
    if (!boardLines) return;
    const timer = setTimeout(() => setBoardOut(false), writeSeconds(boardLines) * 1000 + 800);
    return () => clearTimeout(timer);
  }, [boardLines]);

  const face: Face = thinking
    ? 'thinking'
    : onStage
      ? onStage.devMode ? 'neutral' : (onStage.expression ?? 'happy')
      : failed ? 'sad' : sleepy ? 'sleepy' : 'neutral';

  const talking = speaking || onStage !== null;

  useFrame(({ clock }, rawDt) => {
    const g = root.current;
    if (!g) return;
    const dt = Math.min(rawDt, 0.05); // keeps the spring stable after a slow frame
    const t = clock.elapsedTime;
    const p = playerState.position;

    // Doze off after a while with nothing happening.
    if (talking || thinking || chatOpen) lastActive.current = t;
    const shouldSleep = t - lastActive.current > SLEEP_AFTER_S;
    if (shouldSleep !== sleepy) setSleepy(shouldSleep);

    const writing = boardLines !== null && (performance.now() - boardStart) / 1000 < writeSeconds(boardLines);
    const flying = talking && !writing;
    let stiffness: number;
    if (flying) {
      // Fairy flight: flit around the player on a looping path that swells, dips and darts.
      flight.current += dt * (1.1 + 0.6 * Math.sin(t * 0.8));
      const a = flight.current;
      const r = 1.35 + 0.35 * Math.sin(a * 1.7 + 1);
      target.set(
        p.x + Math.sin(a) * r + Math.sin(a * 2.3) * 0.25,
        1.55 + Math.sin(a * 2.1) * 0.3 + Math.sin(t * 5.3) * 0.05,
        p.z + Math.cos(a) * r,
      );
      stiffness = 18;
    } else {
      // Rest (or write) beside the player's right shoulder.
      const h = playerState.heading;
      target.set(
        p.x - Math.sin(h) * 0.9 + Math.cos(h) * 1.0,
        1.35 + Math.sin(t * 2) * (sleepy ? 0.03 : 0.08),
        p.z - Math.cos(h) * 0.9 - Math.sin(h) * 1.0,
      );
      flight.current = Math.atan2(g.position.x - p.x, g.position.z - p.z); // take off from where it is
      stiffness = 7;
    }
    // Critically damped spring: smooth take-off and a smooth glide home, with no snapping.
    const v = velocity.current;
    const damping = 2 * Math.sqrt(stiffness);
    v.x += ((target.x - g.position.x) * stiffness - v.x * damping) * dt;
    v.y += ((target.y - g.position.y) * stiffness - v.y * damping) * dt;
    v.z += ((target.z - g.position.z) * stiffness - v.z * damping) * dt;
    g.position.addScaledVector(v, dt);

    // Face the player's avatar.
    const want = Math.atan2(p.x - g.position.x, p.z - g.position.z);
    const turn = Math.atan2(Math.sin(want - g.rotation.y), Math.cos(want - g.rotation.y));
    g.rotation.y += turn * Math.min(1, dt * 5);

    // Bank into the direction of travel, like something flying.
    if (body.current) {
      const yaw = g.rotation.y;
      const sideways = v.x * Math.cos(yaw) - v.z * Math.sin(yaw);
      const ahead = v.x * Math.sin(yaw) + v.z * Math.cos(yaw);
      const bankZ = Math.max(-0.45, Math.min(0.45, -sideways * 0.18)) + Math.sin(t * 1.3) * 0.04;
      const bankX = Math.max(-0.3, Math.min(0.3, ahead * 0.12));
      body.current.rotation.z += (bankZ - body.current.rotation.z) * Math.min(1, dt * 6);
      body.current.rotation.x += (bankX - body.current.rotation.x) * Math.min(1, dt * 6);
    }
    if (head.current) {
      const tilt = thinking ? 0.22 : sleepy ? 0.15 : Math.sin(t * (talking ? 2.2 : 0.9)) * (talking ? 0.1 : 0.06);
      head.current.rotation.z += (tilt - head.current.rotation.z) * Math.min(1, dt * 6);
      const nod = writing ? 0.35 : sleepy ? 0.18 : Math.sin(t * 1.1) * 0.04; // look down at the board
      head.current.rotation.x += (nod - head.current.rotation.x) * Math.min(1, dt * 6);
    }
    // Arms: hold-and-scribble while writing, a changing gesture while talking, a gentle sway at rest.
    const gesture = talking ? GESTURES[Math.floor(t / GESTURE_SECONDS + 0.5) % GESTURES.length] : null;
    for (const [arm, side] of [
      [armL.current, -1],
      [armR.current, 1],
    ] as const) {
      if (!arm) continue;
      const [x, z] = writing ? writingPose(side, t) : gesture ? gesturePose(gesture, side, t) : [0, side * 0.12 + Math.sin(t * 2 + side) * 0.05];
      const k = Math.min(1, dt * (writing ? 14 : 7));
      arm.rotation.x += (x - arm.rotation.x) * k;
      arm.rotation.z += (z - arm.rotation.z) * k;
    }

    // Fairy dust trail while flying.
    sparkClock.current += dt;
    if (flying && sparkClock.current > 0.04) {
      sparkClock.current = 0;
      const s = sparks.current[nextSpark.current];
      nextSpark.current = (nextSpark.current + 1) % SPARKS;
      s.life = 1;
      s.x = g.position.x + (Math.random() - 0.5) * 0.25;
      s.y = g.position.y - 0.45 + (Math.random() - 0.5) * 0.15;
      s.z = g.position.z + (Math.random() - 0.5) * 0.25;
    }
    sparks.current.forEach((s, i) => {
      const m = sparkMeshes.current[i];
      if (!m) return;
      s.life = Math.max(0, s.life - dt * 1.3);
      m.visible = s.life > 0;
      m.position.set(s.x, s.y - (1 - s.life) * 0.25, s.z);
      m.scale.setScalar(0.03 * s.life);
      m.rotation.y += dt * 6;
    });

    // Blink every few seconds (not while asleep: the eyes are already shut).
    if (t > blinkAt.current + 0.13) blinkAt.current = t + 2.5 + Math.random() * 3;
    if (eyes.current) eyes.current.scale.y = !sleepy && t > blinkAt.current ? 0.1 : 1;

    // Occasional ear twitch.
    if (t > twitchAt.current + 0.3) twitchAt.current = t + 3 + Math.random() * 5;
    const twitch = t > twitchAt.current ? Math.sin((t - twitchAt.current) * 30) * 0.15 : 0;
    if (earL.current) earL.current.rotation.z = 0.35 + twitch;
    if (earR.current) earR.current.rotation.z = -0.35;

    // Mouth moves while the voice plays.
    if (mouth.current) mouth.current.scale.y = speaking ? 0.6 + Math.abs(Math.sin(t * 14)) * 0.9 : 1;
  });

  const leftEye: EyeKind = face === 'wink' ? 'arc' : face;
  const rightEye: EyeKind = face === 'wink' ? 'line' : face;
  const bubble = thinking
    ? '…'
    : onStage
      ? onStage.text.length > BUBBLE_CHARS ? `${onStage.text.slice(0, BUBBLE_CHARS)}…` : onStage.text
      : chatOpen ? null : sleepy ? '💤 Tap to wake me' : '💬 Tap to chat';

  return (
    <>
      <group ref={root} position={[1, 1.35, -0.9]}>
        <group ref={body} scale={1.25}>
          {/* torso: rounded box with a slimmer base below a seam, like a battery-powered unit */}
          <RoundedBox args={[0.44, 0.3, 0.34]} radius={0.09} smoothness={4} position={[0, -0.05, 0]} castShadow>
            <Shell color={bodyColor} />
          </RoundedBox>
          <RoundedBox args={[0.36, 0.12, 0.28]} radius={0.05} smoothness={4} position={[0, -0.26, 0]} castShadow>
            <Shell color={bodyColor} />
          </RoundedBox>

          {/* battery lid with two clips and a charge light */}
          <RoundedBox args={[0.22, 0.19, 0.03]} radius={0.012} smoothness={3} position={[0, -0.06, 0.162]}>
            <Shell color={lid} />
          </RoundedBox>
          {[-0.045, 0.045].map((x) => (
            <mesh key={x} position={[x, 0.04, 0.178]}>
              <boxGeometry args={[0.035, 0.012, 0.012]} />
              <meshStandardMaterial color={trim} roughness={0.75} />
            </mesh>
          ))}
          <mesh position={[0, -0.13, 0.179]}>
            <planeGeometry args={[0.07, 0.012]} />
            <Glow color={glowColor} />
          </mesh>

          {/* handheld whiteboard, held up in front of the torso while writing */}
          {boardLines && boardOut && (
            <group position={[0, -0.03, 0.26]} rotation={[-0.55, 0, 0]}>
              <HandBoard key={boardStart} lines={boardLines} startedAt={boardStart} />
            </group>
          )}

          {/* hover ball underneath */}
          <mesh position={[0, -0.37, 0]} castShadow>
            <sphereGeometry args={[0.07, 20, 14]} />
            <meshStandardMaterial color={trim} roughness={0.75} />
          </mesh>

          {/* floating oval-rectangle arms, detached from the torso, pivoting from an invisible shoulder */}
          {([
            [-1, armL],
            [1, armR],
          ] as const).map(([side, ref]) => (
            <group key={side} ref={ref} position={[side * 0.31, 0.04, 0]}>
              <RoundedBox args={[0.1, 0.24, 0.1]} radius={0.045} smoothness={4} position={[0, -0.13, 0]} castShadow>
                <Shell color={bodyColor} />
              </RoundedBox>
            </group>
          ))}

          {/* head floats just above the torso */}
          <group ref={head} position={[0, 0.38, 0]}>
            <RoundedBox args={[0.62, 0.46, 0.48]} radius={0.15} smoothness={4} castShadow>
              <Shell color={bodyColor} />
            </RoundedBox>
            {/* dark visor */}
            <RoundedBox args={[0.5, 0.32, 0.12]} radius={0.055} smoothness={4} position={[0, -0.01, 0.2]}>
              <meshPhysicalMaterial color="#0b1220" roughness={0.15} clearcoat={1} />
            </RoundedBox>

            <group ref={eyes} position={[0, 0.03, FACE_Z]}>
              <group position={[-0.11, 0, 0]}>
                <Eye kind={leftEye} side={-1} color={glowColor} heart={heart} />
              </group>
              <group position={[0.11, 0, 0]}>
                <Eye kind={rightEye} side={1} color={glowColor} heart={heart} />
              </group>
            </group>
            <group ref={mouth} position={[0, -0.07, FACE_Z]}>
              <Mouth face={face} color={glowColor} />
            </group>

            {/* headphone discs */}
            {[-1, 1].map((side) => (
              <group key={side} position={[side * 0.31, -0.02, 0]} rotation={[0, 0, Math.PI / 2]}>
                <mesh>
                  <cylinderGeometry args={[0.1, 0.1, 0.06, 24]} />
                  <meshStandardMaterial color={trim} roughness={0.75} metalness={0} />
                </mesh>
                <mesh position={[0, side * 0.032, 0]}>
                  <cylinderGeometry args={[0.05, 0.05, 0.01, 20]} />
                  <Glow color={glowColor} />
                </mesh>
              </group>
            ))}

            {/* robotic cat ears: rounded panels with a glowing inner face */}
            {[-1, 1].map((side) => (
              <group key={side} ref={side < 0 ? earL : earR} position={[side * 0.17, 0.2, -0.02]} rotation={[0, 0, -side * 0.35]}>
                <group scale={[1, 1, 0.55]}>
                  <Ear>
                    <Shell color={bodyColor} />
                  </Ear>
                </group>
                <group position={[0, 0.01, 0.035]} scale={[0.55, 0.6, 0.3]}>
                  <Ear>
                    <Glow color={glowColor} />
                  </Ear>
                </group>
              </group>
            ))}
          </group>
        </group>

        {/* Anchor sits just above the ears; the bubble's bottom-centre is pinned there so it only grows upward. */}
        {bubble && (
          <Html position={[0, 1.05, 0]} distanceFactor={10} zIndexRange={[10, 0]} style={{ transform: 'translate(-50%, -100%)' }}>
            <button
              type="button"
              onClick={() => setChatOpen(true)}
              aria-label={`Echo says: ${bubble}. Open chat`}
              className="relative mb-2 block w-max max-w-64 origin-bottom cursor-pointer rounded-2xl bg-white px-3 py-1.5 text-left text-sm text-slate-800 shadow-lg transition hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              {bubble}
              <span className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 bg-white" aria-hidden />
            </button>
          </Html>
        )}
      </group>

      {/* fairy dust, in world space so it trails behind */}
      {Array.from({ length: SPARKS }, (_, i) => (
        <mesh key={i} ref={(m) => (sparkMeshes.current[i] = m)} visible={false}>
          <octahedronGeometry args={[1, 0]} />
          <Glow color={glowColor} />
        </mesh>
      ))}
    </>
  );
}
