export const ACTIVITIES = {
  study: { label: 'Study session', icon: '📚' },
  hangout: { label: 'Hang out', icon: '💬' },
  music: { label: 'Music jam', icon: '🎵' },
  exercise: { label: 'Exercise challenge', icon: '🏋️' },
} as const;
export type Activity = keyof typeof ACTIVITIES;

export interface Friend {
  friendshipId: string;
  userId: string;
  username: string;
  displayName: string;
  status: 'pending' | 'accepted';
  /** For pending requests: true if they asked you. */
  incoming: boolean;
}

export interface PartyMember {
  userId: string;
  username: string;
  displayName: string;
}

export interface Party {
  id: string;
  activity: Activity;
  leader: string;
  members: PartyMember[];
}

export interface PartyInvite {
  inviteId: string;
  partyId: string;
  activity: Activity;
  inviterUsername: string;
  inviterDisplayName: string;
  memberCount: number;
}

/** What the right-click menu needs to know about another player's avatar. */
export interface PlayerRef {
  userId: string;
  username: string;
  displayName: string;
}

export const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,24}$/;
