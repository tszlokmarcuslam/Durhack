// Your profile, community tags and privacy, as edited under Settings on the Nook page.
// Ported from the React app (src/types/profile.ts, src/types/tags.ts, src/store/profileStore.ts) so both write the
// same `profiles` row with the same limits and the same messages. If one changes, change the other.

export const SOCIAL_KEYS = ['website', 'github', 'linkedin', 'instagram'];
export const LIMITS = { displayName: 40, place: 60, bio: 300, link: 200 };
export const MAX_TAGS = 12, MAX_TAG_LENGTH = 30;

// Community tags (#Manchester, #JazzPiano). Shown as typed (CamelCase), matched by their key: lowercase letters and digits only.
export const tagKey = text => text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
/** Turns free text like "#jazz piano" into a display tag ("JazzPiano"), or null if it isn't usable. */
export function toTag(text) {
  const tag = String(text || '').replace(/^#+/, '').split(/[^\p{L}\p{N}]+/u).filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join('');
  return tag.length >= 2 && tag.length <= MAX_TAG_LENGTH ? tag : null;
}
export const CURATED_TAGS = [
  { group: 'Community', tags: ['InternationalStudents', 'FirstGen', 'MatureStudents', 'Commuters', 'Postgrads', 'LGBTQSociety'] },
  { group: 'Societies', tags: ['Hackathons', 'ComputingSociety', 'ChessSociety', 'DebateSociety', 'DramaSociety', 'MusicSociety'] },
  { group: 'Study', tags: ['Maths', 'Physics', 'ComputerScience', 'Medicine', 'Law', 'Economics'] },
  { group: 'Sport & fitness', tags: ['Weightlifting', 'Running', 'Climbing', 'Football', 'Yoga', 'Swimming'] },
  { group: 'Arts & hobbies', tags: ['JazzPiano', 'Guitar', 'Photography', 'Gaming', 'Cooking', 'Anime'] }
];

// Everything is private until the player opts in.
export const emptyProfile = () => ({
  username: '', displayName: '', city: '', university: '', subject: '', tags: [], bio: '',
  social: { website: '', github: '', linkedin: '', instagram: '' },
  isDiscoverable: false, shareLocation: false, shareEducation: false, shareInterests: false
});

const isHttpsUrl = text => { try { return new URL(text).protocol === 'https:'; } catch (e) { return false; } };

/** Returns { field: message } for everything that is wrong; an empty object means the form can be saved. */
export function validateProfile(f) {
  const e = {};
  if (!/^[a-zA-Z0-9_]{3,24}$/.test(f.username)) e.username = '3 to 24 letters, numbers or _';
  if (!f.displayName.trim()) e.displayName = 'Enter a name';
  else if (f.displayName.trim().length > LIMITS.displayName) e.displayName = 'At most ' + LIMITS.displayName + ' characters';
  ['city', 'university', 'subject'].forEach(k => { if (f[k].trim().length > LIMITS.place) e[k] = 'At most ' + LIMITS.place + ' characters'; });
  if (f.tags.length > MAX_TAGS) e.tags = 'At most ' + MAX_TAGS + ' tags';
  else if (f.tags.some(t => toTag(t) !== t)) e.tags = 'Tags can only use letters and numbers';
  if (f.bio.trim().length > LIMITS.bio) e.bio = 'At most ' + LIMITS.bio + ' characters';
  SOCIAL_KEYS.forEach(k => {
    const url = f.social[k].trim(); if (!url) return;
    if (url.length > LIMITS.link) e[k] = 'At most ' + LIMITS.link + ' characters'; else if (!isHttpsUrl(url)) e[k] = 'Start with https://';
  });
  return e;
}

const orNull = s => s.trim() || null;
export function toRow(id, f) {
  const social = {}; SOCIAL_KEYS.forEach(k => { if (f.social[k].trim()) social[k] = f.social[k].trim(); });
  return {
    id, username: f.username.trim(), display_name: f.displayName.trim(), location_city: orNull(f.city), university: orNull(f.university), subject: orNull(f.subject),
    interests: f.tags, bio: orNull(f.bio), social_links: social,
    is_discoverable: f.isDiscoverable, share_location: f.shareLocation, share_education: f.shareEducation, share_interests: f.shareInterests
  };
}
export function fromRow(r) {
  const f = emptyProfile(); SOCIAL_KEYS.forEach(k => { const v = r.social_links && r.social_links[k]; if (typeof v === 'string') f.social[k] = v; });
  return Object.assign(f, {
    username: r.username || '', displayName: r.display_name || '', city: r.location_city || '', university: r.university || '', subject: r.subject || '',
    tags: Array.isArray(r.interests) ? r.interests : [], bio: r.bio || '',
    isDiscoverable: !!r.is_discoverable, shareLocation: !!r.share_location, shareEducation: !!r.share_education, shareInterests: !!r.share_interests
  });
}

const COLUMNS = 'id, username, display_name, location_city, university, subject, interests, bio, social_links, is_discoverable, share_location, share_education, share_interests';

/** sb: the Supabase client (backend.js `client`). Resolves to { form } (form is null for a new player) or { error }. */
export async function loadProfile(sb, userId) {
  if (!sb || !userId) return { error: 'Sign in to edit your profile.' };
  const { data, error } = await sb.from('profiles').select(COLUMNS).eq('id', userId).maybeSingle();
  if (error) return { error: "Couldn't load your profile. Check your connection and try again." };
  return { form: data ? fromRow(data) : null };
}
/** Resolves to an error message for the player, or null when it saved. Row Level Security only lets a player write their own row. */
export async function saveProfile(sb, userId, form) {
  if (!sb || !userId) return 'Your session has ended. Sign in again.';
  const { error } = await sb.from('profiles').upsert(toRow(userId, form));
  if (!error) return null;
  if (error.code === '23505') return 'That username is taken. Try another.';
  if (error.code === '23514') return 'One of the fields is too long or in the wrong format.';
  return "Couldn't save your profile. Check your connection and try again.";
}
