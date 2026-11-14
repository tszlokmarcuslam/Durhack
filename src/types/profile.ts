// The player's own profile, as edited in Settings. Limits mirror the checks in supabase/schema.sql,
// so most mistakes are caught here with a friendly message before the database rejects them.

import { MAX_TAGS, toTag } from './tags';

export const SOCIAL_KEYS = ['website', 'github', 'linkedin', 'instagram'] as const;
export type SocialKey = (typeof SOCIAL_KEYS)[number];

export interface ProfileForm {
  username: string;
  displayName: string;
  city: string;
  university: string;
  subject: string;
  /** Community tags as shown, e.g. "JazzPiano" (no #). Stored in profiles.interests. */
  tags: string[];
  bio: string;
  social: Record<SocialKey, string>;
  isDiscoverable: boolean;
  shareLocation: boolean;
  shareEducation: boolean;
  shareInterests: boolean;
}

/** The profiles table columns this form reads and writes. */
export interface ProfileRow {
  id: string;
  username: string;
  display_name: string;
  location_city: string | null;
  university: string | null;
  subject: string | null;
  interests: string[];
  bio: string | null;
  social_links: Partial<Record<SocialKey, string>>;
  is_discoverable: boolean;
  share_location: boolean;
  share_education: boolean;
  share_interests: boolean;
}

export type ProfileErrors = Partial<Record<keyof ProfileForm | SocialKey, string>>;

export const LIMITS = { displayName: 40, place: 60, bio: 300, link: 200 } as const;

export const emptyProfile = (): ProfileForm => ({
  username: '',
  displayName: '',
  city: '',
  university: '',
  subject: '',
  tags: [],
  bio: '',
  social: { website: '', github: '', linkedin: '', instagram: '' },
  // Everything is private until the player opts in.
  isDiscoverable: false,
  shareLocation: false,
  shareEducation: false,
  shareInterests: false,
});

export function validateProfile(f: ProfileForm): ProfileErrors {
  const e: ProfileErrors = {};
  if (!/^[a-zA-Z0-9_]{3,24}$/.test(f.username)) e.username = '3-24 letters, numbers or underscores.';
  if (!f.displayName.trim()) e.displayName = 'Enter a display name.';
  else if (f.displayName.trim().length > LIMITS.displayName) e.displayName = `At most ${LIMITS.displayName} characters.`;
  for (const key of ['city', 'university', 'subject'] as const) {
    if (f[key].trim().length > LIMITS.place) e[key] = `At most ${LIMITS.place} characters.`;
  }
  if (f.tags.length > MAX_TAGS) e.tags = `At most ${MAX_TAGS} tags.`;
  else if (f.tags.some((t) => toTag(t) !== t)) e.tags = 'Tags can only use letters and numbers.';
  if (f.bio.trim().length > LIMITS.bio) e.bio = `At most ${LIMITS.bio} characters.`;
  for (const key of SOCIAL_KEYS) {
    const url = f.social[key].trim();
    if (!url) continue;
    if (url.length > LIMITS.link) e[key] = `At most ${LIMITS.link} characters.`;
    else if (!isHttpsUrl(url)) e[key] = 'Use a full link starting with https://';
  }
  return e;
}

export function isHttpsUrl(text: string): boolean {
  try {
    return new URL(text).protocol === 'https:';
  } catch {
    return false;
  }
}

const orNull = (s: string) => s.trim() || null;

export function toRow(id: string, f: ProfileForm): ProfileRow {
  const social: Partial<Record<SocialKey, string>> = {};
  for (const key of SOCIAL_KEYS) if (f.social[key].trim()) social[key] = f.social[key].trim();
  return {
    id,
    username: f.username.trim(),
    display_name: f.displayName.trim(),
    location_city: orNull(f.city),
    university: orNull(f.university),
    subject: orNull(f.subject),
    interests: f.tags,
    bio: orNull(f.bio),
    social_links: social,
    is_discoverable: f.isDiscoverable,
    share_location: f.shareLocation,
    share_education: f.shareEducation,
    share_interests: f.shareInterests,
  };
}

export function fromRow(r: ProfileRow): ProfileForm {
  const social = emptyProfile().social;
  for (const key of SOCIAL_KEYS) {
    const value = r.social_links?.[key];
    if (typeof value === 'string') social[key] = value;
  }
  return {
    username: r.username,
    displayName: r.display_name,
    city: r.location_city ?? '',
    university: r.university ?? '',
    subject: r.subject ?? '',
    tags: r.interests ?? [],
    bio: r.bio ?? '',
    social,
    isDiscoverable: r.is_discoverable,
    shareLocation: r.share_location,
    shareEducation: r.share_education,
    shareInterests: r.share_interests,
  };
}
