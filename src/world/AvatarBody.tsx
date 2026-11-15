import { Html } from '@react-three/drei';

/**
 * Placeholder character used for your own avatar and for other players.
 * Swap this for the real character model: both Player and RemotePlayers render it.
 * The group it sits in already handles position and facing (+z is forward).
 */
export function AvatarBody({ name, color = '#6366f1' }: { name: string; color?: string }) {
  return (
    <>
      <mesh position={[0, 0.75, 0]} castShadow>
        <capsuleGeometry args={[0.35, 0.8, 4, 12]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 1.65, 0]} castShadow>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshStandardMaterial color="#fcd9b6" />
      </mesh>
      {/* nose marks the facing direction */}
      <mesh position={[0, 1.65, 0.3]}>
        <boxGeometry args={[0.08, 0.08, 0.1]} />
        <meshStandardMaterial color="#f59e0b" />
      </mesh>
      <Html position={[0, 2.25, 0]} center distanceFactor={10} zIndexRange={[10, 0]}>
        <span className="pointer-events-none select-none whitespace-nowrap rounded bg-black/60 px-2 py-0.5 text-sm text-white">{name}</span>
      </Html>
    </>
  );
}
