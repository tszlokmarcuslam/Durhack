import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Player } from './Player';
import { Pet } from './Pet';
import { WORLD_HALF_SIZE } from './playerState';

// Fixed placeholder scenery: [x, z, height]
const TREES: [number, number, number][] = [
  [-8, -6, 2.4], [6, -9, 3], [10, 4, 2.2], [-12, 8, 2.8], [3, 12, 2.5], [-5, 14, 3.2], [14, -12, 2.6],
];

function Tree({ x, z, height }: { x: number; z: number; height: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.6, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.25, 1.2, 6]} />
        <meshStandardMaterial color="#7c4a21" />
      </mesh>
      <mesh position={[0, 1.2 + height / 2, 0]} castShadow>
        <coneGeometry args={[1.1, height, 6]} />
        <meshStandardMaterial color="#15803d" flatShading />
      </mesh>
    </group>
  );
}

export function World({ playerName }: { playerName: string }) {
  const size = WORLD_HALF_SIZE * 2 + 4;
  return (
    <Canvas shadows camera={{ position: [0, 5, -8], fov: 55 }}>
      <color attach="background" args={['#bfdbfe']} />
      <fog attach="fog" args={['#bfdbfe', 25, 60]} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[10, 15, 5]} intensity={1.2} castShadow shadow-mapSize={[1024, 1024]} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial color="#86efac" />
      </mesh>
      {/* study plaza placeholder */}
      <mesh position={[0, 0.02, 6]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[4, 24]} />
        <meshStandardMaterial color="#e2e8f0" />
      </mesh>
      {TREES.map(([x, z, height]) => (
        <Tree key={`${x},${z}`} x={x} z={z} height={height} />
      ))}

      <Player name={playerName} />
      <Pet />

      <OrbitControls makeDefault enablePan={false} minDistance={4} maxDistance={16} maxPolarAngle={Math.PI / 2 - 0.08} />
    </Canvas>
  );
}
