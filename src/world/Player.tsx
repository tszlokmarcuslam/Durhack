import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { MathUtils, Vector3, type Group } from 'three';
import { playerState, WORLD_HALF_SIZE } from './playerState';
import { AvatarBody } from './AvatarBody';

const SPEED = 5;
const UP = new Vector3(0, 1, 0);
const forward = new Vector3();
const right = new Vector3();
const move = new Vector3();
const NO_KEYS = new Set<string>();

function isTyping(target: EventTarget | null) {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
}

/** Tracks held keys, ignoring keystrokes typed into form fields (e.g. the chat box). */
function useHeldKeys() {
  const held = useRef(new Set<string>());
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (!isTyping(e.target)) held.current.add(e.code);
    };
    const up = (e: KeyboardEvent) => held.current.delete(e.code);
    const clear = () => held.current.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clear);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear);
    };
  }, []);
  return held;
}

export function Player({ name }: { name: string }) {
  const group = useRef<Group>(null);
  const held = useHeldKeys();

  useFrame(({ camera, controls }, dt) => {
    const g = group.current;
    if (!g) return;
    const k = playerState.frozen ? NO_KEYS : held.current;
    const z = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    const x = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);

    if (x || z) {
      // Move relative to where the camera looks, flattened onto the ground.
      camera.getWorldDirection(forward).setY(0).normalize();
      right.crossVectors(forward, UP);
      move.set(0, 0, 0).addScaledVector(forward, z).addScaledVector(right, x).normalize();
      const before = g.position.clone();
      g.position.addScaledVector(move, SPEED * Math.min(dt, 0.1));
      g.position.x = MathUtils.clamp(g.position.x, -WORLD_HALF_SIZE, WORLD_HALF_SIZE);
      g.position.z = MathUtils.clamp(g.position.z, -WORLD_HALF_SIZE, WORLD_HALF_SIZE);
      camera.position.add(before.sub(g.position).negate()); // camera rides along
      playerState.heading = Math.atan2(move.x, move.z);
    }
    // Turn towards heading along the shortest arc.
    const diff = Math.atan2(Math.sin(playerState.heading - g.rotation.y), Math.cos(playerState.heading - g.rotation.y));
    g.rotation.y += diff * Math.min(1, dt * 12);

    playerState.position.copy(g.position);
    const orbit = controls as unknown as { target: Vector3 } | null;
    orbit?.target.set(g.position.x, g.position.y + 1.2, g.position.z);
  });

  return (
    <group ref={group}>
      <AvatarBody name={name} />
    </group>
  );
}
