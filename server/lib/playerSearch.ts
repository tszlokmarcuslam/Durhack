import type { PublicPlayer } from '../../src/types/companion';

export interface PlayerSearchFilters {
  city?: string;
  university?: string;
  subject?: string;
  interests?: string[];
  limit: number;
}

export type ValidationResult =
  | { ok: true; value: PlayerSearchFilters }
  | { ok: false; error: string };

const TEXT_KEYS = ['city', 'university', 'subject'] as const;
const ALLOWED_KEYS = new Set<string>([...TEXT_KEYS, 'interests', 'limit']);
const MAX_TEXT = 60;
const MAX_INTEREST = 30;
const MAX_INTERESTS = 5;
const MAX_LIMIT = 10;
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > max || CONTROL_CHARS.test(trimmed)) return null;
  return trimmed;
}

/**
 * Validates the structured filters the LLM (or any caller) proposes for a player search.
 * Unknown keys are rejected so the model cannot smuggle in parameters.
 */
export function validateSearchFilters(input: unknown): ValidationResult {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, error: 'Filters must be an object.' };
  }
  const raw = input as Record<string, unknown>;
  for (const key of Object.keys(raw)) {
    if (!ALLOWED_KEYS.has(key)) return { ok: false, error: `Unknown filter "${key}".` };
  }

  const value: PlayerSearchFilters = { limit: 5 };

  for (const key of TEXT_KEYS) {
    if (raw[key] === undefined) continue;
    const text = cleanText(raw[key], MAX_TEXT);
    if (!text) return { ok: false, error: `${key} must be 1-${MAX_TEXT} plain characters.` };
    value[key] = text;
  }
  if (raw.interests !== undefined) {
    if (!Array.isArray(raw.interests) || raw.interests.length === 0 || raw.interests.length > MAX_INTERESTS) {
      return { ok: false, error: `interests must be a list of 1-${MAX_INTERESTS} items.` };
    }
    const interests: string[] = [];
    for (const item of raw.interests) {
      const interest = cleanText(item, MAX_INTEREST);
      if (!interest) return { ok: false, error: `Each interest must be 1-${MAX_INTEREST} plain characters.` };
      interests.push(interest.toLowerCase()); // profiles store interests lowercased (see schema trigger)
    }
    value.interests = interests;
  }
  if (raw.limit !== undefined) {
    const limit = raw.limit;
    if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
      return { ok: false, error: `limit must be an integer from 1 to ${MAX_LIMIT}.` };
    }
    value.limit = limit;
  }

  if (!value.city && !value.university && !value.subject && !value.interests) {
    return { ok: false, error: 'At least one of city, university, subject or interests is required.' };
  }
  return { ok: true, value };
}

/** Escapes LIKE wildcards so user text is matched literally. */
export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** The columns a discovery query reads. Private fields (social links, email) are never selected. */
export const SEARCH_COLUMNS =
  'id, username, display_name, location_city, university, subject, interests, bio, ' +
  'share_location, share_education, share_interests, is_discoverable';

export interface ProfileSearchRow {
  id: string;
  username: string;
  display_name: string;
  location_city: string | null;
  university: string | null;
  subject: string | null;
  interests: string[] | null;
  bio: string | null;
  share_location: boolean;
  share_education: boolean;
  share_interests: boolean;
  is_discoverable: boolean;
}

/**
 * Projects a database row to the public shape. Each optional field is included only when
 * its owner opted in, so this is the final privacy gate even if a query is wrong.
 */
export function toPublicPlayer(row: ProfileSearchRow): PublicPlayer | null {
  if (!row.is_discoverable) return null;
  const player: PublicPlayer = { id: row.id, username: row.username, displayName: row.display_name };
  if (row.bio) player.bio = row.bio;
  if (row.share_location && row.location_city) player.city = row.location_city;
  if (row.share_education) {
    if (row.university) player.university = row.university;
    if (row.subject) player.subject = row.subject;
  }
  if (row.share_interests && row.interests?.length) player.interests = row.interests;
  return player;
}
