import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { fromRow, toRow, type ProfileForm, type ProfileRow } from '../types/profile';

const COLUMNS =
  'id, username, display_name, location_city, university, subject, interests, bio, social_links, ' +
  'is_discoverable, share_location, share_education, share_interests';

interface ProfileState {
  /** null = no profile saved yet (new player). */
  profile: ProfileForm | null;
  status: 'idle' | 'loading' | 'loaded' | 'error';
  loadError: string | null;
  load: () => Promise<void>;
  /** Returns an error message, or null on success. */
  save: (form: ProfileForm) => Promise<string | null>;
  clear: () => void;
}

async function currentUserId(): Promise<string | null> {
  return (await supabase?.auth.getSession())?.data.session?.user.id ?? null;
}

/**
 * The signed-in player's own profile. Reads and writes go straight to Supabase with the player's
 * session; Row Level Security only lets a player touch their own row.
 */
export const useProfileStore = create<ProfileState>((set) => ({
  profile: null,
  status: 'idle',
  loadError: null,

  async load() {
    const id = await currentUserId();
    if (!supabase || !id) return set({ status: 'error', loadError: 'Sign in to edit your profile.' });
    set({ status: 'loading', loadError: null });
    const { data, error } = await supabase.from('profiles').select(COLUMNS).eq('id', id).maybeSingle();
    if (error) return set({ status: 'error', loadError: "Couldn't load your profile. Check your connection and try again." });
    set({ status: 'loaded', profile: data ? fromRow(data as unknown as ProfileRow) : null });
  },

  async save(form) {
    const id = await currentUserId();
    if (!supabase || !id) return 'Your session has ended. Sign in again.';
    const { error } = await supabase.from('profiles').upsert(toRow(id, form));
    if (error) {
      if (error.code === '23505') return 'That username is taken. Try another.';
      if (error.code === '23514') return 'One of the fields is too long or in the wrong format.';
      return "Couldn't save your profile. Check your connection and try again.";
    }
    set({ profile: form });
    return null;
  },

  clear: () => set({ profile: null, status: 'idle', loadError: null }),
}));
