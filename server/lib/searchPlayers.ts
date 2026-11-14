import type { SupabaseClient } from '@supabase/supabase-js';
import {
  escapeLike,
  SEARCH_COLUMNS,
  toPublicPlayer,
  type PlayerSearchFilters,
  type ProfileSearchRow,
} from './playerSearch';
import type { PublicPlayer } from '../../src/types/companion';

/**
 * Runs a validated search against Supabase. Filters go through the PostgREST query builder
 * (parameterised), never raw SQL. Only discoverable profiles are returned, and a field can
 * only be matched on when its owner shares it.
 */
export async function searchPlayers(
  db: SupabaseClient,
  viewerId: string,
  filters: PlayerSearchFilters,
): Promise<PublicPlayer[]> {
  let query = db
    .from('profiles')
    .select(SEARCH_COLUMNS)
    .eq('is_discoverable', true)
    .neq('id', viewerId)
    .limit(filters.limit);

  if (filters.city) {
    query = query.eq('share_location', true).ilike('location_city', `%${escapeLike(filters.city)}%`);
  }
  if (filters.university) {
    query = query.eq('share_education', true).ilike('university', `%${escapeLike(filters.university)}%`);
  }
  if (filters.subject) {
    query = query.eq('share_education', true).ilike('subject', `%${escapeLike(filters.subject)}%`);
  }
  if (filters.interests) {
    query = query.eq('share_interests', true).overlaps('interests', filters.interests);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Player search failed: ${error.message}`);

  const players: PublicPlayer[] = [];
  for (const row of (data ?? []) as unknown as ProfileSearchRow[]) {
    const player = toPublicPlayer(row);
    if (player) players.push(player);
  }
  return players;
}
