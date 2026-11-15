import { useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import type { Group } from 'three';
import { useSocialStore } from '../store/socialStore';
import { AvatarBody } from './AvatarBody';
import { isFresh, remotePlayers, useWorldPlayers } from './multiplayer';

const COLORS = ['#0ea5e9', '#f97316', '#10b981', '#e11d48', '#a855f7', '#eab308', '#14b8a6', '#ec4899'];
const colorFor = (id: string) => COLORS[[...id].reduce((n, c) => n + c.charCodeAt(0), 0) % COLORS.length];

function RemotePlayer({ id }: { id: string }) {
  const group = useRef<Group>(null);
  const placed = useRef(false);
  const player = remotePlayers.get(id);

  useFrame((_, dt) => {
    const g = group.current;
    const p = remotePlayers.get(id);
    if (!g || !p) return;
    g.visible = isFresh(p);
    if (!g.visible) return;
    if (!placed.current) {
      g.position.set(p.x, 0, p.z); // first sighting: appear in place rather than sliding in from the origin
      placed.current = true;
    }
    // Ease towards the latest reported position, hiding the gaps between network updates.
    const k = 1 - Math.exp(-12 * dt);
    g.position.x += (p.x - g.position.x) * k;
    g.position.z += (p.z - g.position.z) * k;
    const turn = Math.atan2(Math.sin(p.heading - g.rotation.y), Math.cos(p.heading - g.rotation.y));
    g.rotation.y += turn * k;
  });

  const openMenu = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const p = remotePlayers.get(id);
    if (!p?.username) return; // no profile yet, so nothing to add them by
    useSocialStore.getState().openPlayerMenu({ userId: id, username: p.username, displayName: p.displayName }, e.nativeEvent.clientX, e.nativeEvent.clientY);
  };

  if (!player) return null;
  return (
    <group ref={group} visible={false} onContextMenu={openMenu}>
      <AvatarBody name={player.displayName} color={colorFor(id)} />
    </group>
  );
}

/** Everyone else currently in the world. */
export function RemotePlayers() {
  const ids = useWorldPlayers((s) => s.ids);
  return (
    <>
      {ids.map((id) => (
        <RemotePlayer key={id} id={id} />
      ))}
    </>
  );
}
