import { create } from 'zustand';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { USERNAME_PATTERN } from '../types/social';
import { playerState, WORLD_HALF_SIZE } from './playerState';

// Multiplayer over Supabase Realtime: presence says who is in the world (and their names),
// broadcast carries positions. Positions are sent while moving (10 per second) and as a
// heartbeat once a second when standing still.
// shortcut: realtime messages are not verified server-side, so a modified client could send a
// fake position or name for itself; move to private channels with Realtime Authorization (RLS on
// realtime.messages) before a public launch.

const CHANNEL = 'echoworld-world';
const SEND_MS = 100;
const HEARTBEAT_MS = 1000;
const STALE_MS = 6000;
const LIMIT = WORLD_HALF_SIZE + 1;

export interface RemotePlayer {
  username: string;
  displayName: string;
  /** Latest reported position and facing; the renderer eases towards these. */
  x: number;
  z: number;
  heading: number;
  lastSeen: number;
}

/** Live per-player state, mutated by network messages and read every frame (kept out of React). */
export const remotePlayers = new Map<string, RemotePlayer>();

/** Which remote players exist, for React to render. Changes only on join/leave, not on movement. */
export const useWorldPlayers = create<{ ids: string[] }>(() => ({ ids: [] }));

const clamp = (n: number) => Math.max(-LIMIT, Math.min(LIMIT, n));

/** Validates a position message from another client. Returns null if it isn't usable. */
export function parsePosition(payload: unknown): { x: number; z: number; heading: number } | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const { x, z, h } = payload as Record<string, unknown>;
  if (![x, z, h].every((n) => typeof n === 'number' && Number.isFinite(n))) return null;
  return { x: clamp(x as number), z: clamp(z as number), heading: (h as number) % (Math.PI * 2) };
}

/** Validates the name a client announces in presence. */
export function parseIdentity(meta: unknown): { username: string; displayName: string } | null {
  if (typeof meta !== 'object' || meta === null) return null;
  const { username, displayName } = meta as Record<string, unknown>;
  if (typeof displayName !== 'string' || !displayName.trim()) return null;
  return {
    username: typeof username === 'string' && USERNAME_PATTERN.test(username) ? username : '',
    displayName: displayName.trim().slice(0, 40),
  };
}

let channel: RealtimeChannel | null = null;
let timer: ReturnType<typeof setInterval> | null = null;

function publishIds() {
  useWorldPlayers.setState({ ids: [...remotePlayers.keys()].sort() });
}

/** Join the shared world: announce yourself, start sending your position, start receiving others'. */
export function joinWorld(me: { userId: string; username: string; displayName: string }) {
  if (!supabase) return;
  leaveWorld();
  const ch = supabase.channel(CHANNEL, { config: { presence: { key: me.userId }, broadcast: { self: false } } });
  channel = ch;

  ch.on('presence', { event: 'sync' }, () => {
    const state = ch.presenceState();
    for (const id of [...remotePlayers.keys()]) if (!state[id]) remotePlayers.delete(id); // left
    for (const [id, metas] of Object.entries(state)) {
      if (id === me.userId) continue;
      const who = parseIdentity(metas[0]);
      if (!who) continue;
      const known = remotePlayers.get(id);
      if (known) Object.assign(known, who);
      else remotePlayers.set(id, { ...who, x: 0, z: 0, heading: 0, lastSeen: 0 }); // hidden until its first position
    }
    publishIds();
  });

  ch.on('broadcast', { event: 'pos' }, ({ payload }) => {
    const id = typeof payload?.id === 'string' ? payload.id : null;
    const pos = parsePosition(payload);
    const player = id && remotePlayers.get(id); // only players announced through presence
    if (!player || !pos) return;
    Object.assign(player, pos, { lastSeen: Date.now() });
  });

  ch.subscribe((status) => {
    if (status !== 'SUBSCRIBED') return;
    void ch.track({ username: me.username, displayName: me.displayName });
    let last = { x: NaN, z: NaN, h: NaN, at: 0 };
    timer = setInterval(() => {
      const { x, z } = playerState.position;
      const h = playerState.heading;
      const moved = Math.abs(x - last.x) > 0.01 || Math.abs(z - last.z) > 0.01 || Math.abs(h - last.h) > 0.01;
      if (!moved && Date.now() - last.at < HEARTBEAT_MS) return;
      last = { x, z, h, at: Date.now() };
      void ch.send({ type: 'broadcast', event: 'pos', payload: { id: me.userId, x, z, h } });
    }, SEND_MS);
  });
}

export function leaveWorld() {
  if (timer) clearInterval(timer);
  timer = null;
  if (channel) void supabase?.removeChannel(channel);
  channel = null;
  remotePlayers.clear();
  publishIds();
}

/** True if we've heard from this player recently enough to show them. */
export const isFresh = (p: RemotePlayer) => Date.now() - p.lastSeen < STALE_MS;
