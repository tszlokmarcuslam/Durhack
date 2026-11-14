import { create } from 'zustand';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Activity, Friend, Party, PartyInvite, PlayerRef } from '../types/social';

// shortcut: changes from other players arrive by a realtime "nudge" plus a 30 s poll; switch to
// Postgres change subscriptions if the poll becomes too slow or too chatty.
const POLL_MS = 30_000;

interface SocialState {
  me: string | null;
  friends: Friend[];
  party: Party | null;
  invites: PartyInvite[];
  /** User ids currently connected to EchoWorld. */
  online: Set<string>;
  loaded: boolean;
  /** Last error from loading the lists (actions return their own errors). */
  loadError: string | null;
  /** Right-click menu for another player's avatar. */
  menu: (PlayerRef & { x: number; y: number }) | null;

  start: (userId: string) => void;
  stop: () => void;
  refresh: () => Promise<void>;
  openPlayerMenu: (player: PlayerRef, x: number, y: number) => void;
  closePlayerMenu: () => void;

  // Each action returns a message to show (success or error) and refreshes the lists.
  addFriend: (username: string) => Promise<Result>;
  respondToRequest: (friend: Friend, accept: boolean) => Promise<Result>;
  removeFriend: (friend: Friend) => Promise<Result>;
  createParty: (activity: Activity) => Promise<Result>;
  setActivity: (activity: Activity) => Promise<Result>;
  inviteToParty: (friend: Pick<Friend, 'userId' | 'displayName'>) => Promise<Result>;
  respondToInvite: (invite: PartyInvite, accept: boolean) => Promise<Result>;
  leaveParty: () => Promise<Result>;
}

export interface Result {
  ok: boolean;
  message: string;
}

let channel: RealtimeChannel | null = null;
let poll: ReturnType<typeof setInterval> | null = null;

/** Calls a database function. Messages raised by our SQL functions are written for players, so show them as-is. */
async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<{ data: T | null; error: string | null }> {
  if (!supabase) return { data: null, error: 'Friends need Supabase, which is not configured.' };
  const { data, error } = await supabase.rpc(fn, args);
  if (!error) return { data: data as T, error: null };
  if (error.code === 'P0001') return { data: null, error: error.message };
  if (error.code === 'PGRST202') return { data: null, error: 'Friends are not set up on the server yet (run migration 005).' };
  return { data: null, error: "Something went wrong. Check your connection and try again." };
}

/** Tell another player's client to refresh its lists. Carries no data, so it is harmless if anyone sends it. */
function nudge(userId: string) {
  void channel?.send({ type: 'broadcast', event: 'nudge', payload: { to: userId } });
}

function nudgeParty(party: Party | null, me: string | null) {
  party?.members.forEach((m) => m.userId !== me && nudge(m.userId));
}

export const useSocialStore = create<SocialState>((set, get) => {
  async function act(fn: string, args: Record<string, unknown> | undefined, success: string, notify?: string): Promise<Result> {
    const { error } = await rpc(fn, args);
    if (error) return { ok: false, message: error };
    if (notify) nudge(notify);
    await get().refresh();
    return { ok: true, message: success };
  }

  return {
    me: null,
    friends: [],
    party: null,
    invites: [],
    online: new Set(),
    loaded: false,
    loadError: null,
    menu: null,

    start(userId) {
      if (!supabase || get().me === userId) return;
      get().stop();
      set({ me: userId });
      // Presence: everyone signed in joins one channel; the presence keys are user ids.
      channel = supabase.channel('echoworld-online', { config: { presence: { key: userId } } });
      channel
        .on('presence', { event: 'sync' }, () => set({ online: new Set(Object.keys(channel?.presenceState() ?? {})) }))
        .on('broadcast', { event: 'nudge' }, ({ payload }) => payload?.to === get().me && void get().refresh())
        .subscribe((status) => status === 'SUBSCRIBED' && void channel?.track({ since: Date.now() }));
      poll = setInterval(() => void get().refresh(), POLL_MS);
      void get().refresh();
    },

    stop() {
      if (poll) clearInterval(poll);
      poll = null;
      if (channel) void supabase?.removeChannel(channel);
      channel = null;
      set({ me: null, friends: [], party: null, invites: [], online: new Set(), loaded: false, loadError: null, menu: null });
    },

    async refresh() {
      const [friends, party, invites] = await Promise.all([
        rpc<{ friendship_id: string; user_id: string; username: string; display_name: string; status: Friend['status']; incoming: boolean }[]>('my_friends'),
        rpc<{ party_id: string; activity: Activity; leader: string; user_id: string; username: string; display_name: string }[]>('my_party'),
        rpc<{ invite_id: string; party_id: string; activity: Activity; inviter_username: string; inviter_display_name: string; member_count: number }[]>('my_party_invites'),
      ]);
      const error = friends.error ?? party.error ?? invites.error;
      if (error) return set({ loaded: true, loadError: error });
      const rows = party.data ?? [];
      set({
        loaded: true,
        loadError: null,
        friends: (friends.data ?? []).map((f) => ({
          friendshipId: f.friendship_id,
          userId: f.user_id,
          username: f.username,
          displayName: f.display_name,
          status: f.status,
          incoming: f.incoming,
        })),
        party: rows.length
          ? {
              id: rows[0].party_id,
              activity: rows[0].activity,
              leader: rows[0].leader,
              members: rows.map((r) => ({ userId: r.user_id, username: r.username, displayName: r.display_name })),
            }
          : null,
        invites: (invites.data ?? []).map((i) => ({
          inviteId: i.invite_id,
          partyId: i.party_id,
          activity: i.activity,
          inviterUsername: i.inviter_username,
          inviterDisplayName: i.inviter_display_name,
          memberCount: Number(i.member_count),
        })),
      });
    },

    openPlayerMenu: (player, x, y) => set({ menu: { ...player, x, y } }),
    closePlayerMenu: () => set({ menu: null }),

    async addFriend(username) {
      const { data, error } = await rpc<string>('send_friend_request', { target_username: username });
      if (error) return { ok: false, message: error };
      await get().refresh();
      const friend = get().friends.find((f) => f.username.toLowerCase() === username.toLowerCase());
      if (friend) nudge(friend.userId);
      const name = friend?.displayName ?? `@${username}`;
      const messages: Record<string, string> = {
        requested: `Friend request sent to ${name}.`,
        accepted: `You're now friends with ${name}!`,
        already_friends: `You're already friends with ${name}.`,
        already_requested: `You've already sent ${name} a request.`,
      };
      return { ok: true, message: messages[data ?? ''] ?? 'Done.' };
    },
    respondToRequest: (friend, accept) =>
      act(
        'respond_friend_request',
        { request_id: friend.friendshipId, accept },
        accept ? `You're now friends with ${friend.displayName}!` : 'Request declined.',
        accept ? friend.userId : undefined,
      ),
    removeFriend: (friend) =>
      act('remove_friend', { other: friend.userId }, friend.status === 'accepted' ? `Removed ${friend.displayName}.` : 'Request cancelled.'),
    createParty: (activity) => act('create_party', { new_activity: activity }, 'Party created. Invite some friends!'),
    async setActivity(activity) {
      const result = await act('set_party_activity', { new_activity: activity }, 'Activity changed.');
      nudgeParty(get().party, get().me);
      return result;
    },
    inviteToParty: (friend) => act('invite_to_party', { friend: friend.userId }, `Invited ${friend.displayName}.`, friend.userId),
    async respondToInvite(invite, accept) {
      const result = await act('respond_party_invite', { invite_id: invite.inviteId, accept }, accept ? `You joined ${invite.inviterDisplayName}'s party.` : 'Invite declined.');
      if (result.ok && accept) nudgeParty(get().party, get().me);
      return result;
    },
    async leaveParty() {
      const left = get().party;
      const result = await act('leave_party', undefined, 'You left the party.');
      if (result.ok) nudgeParty(left, get().me);
      return result;
    },
  };
});
