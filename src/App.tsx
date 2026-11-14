import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { World } from './world/World';
import { CompanionChat } from './components/CompanionChat';
import { AuthBar } from './components/AuthBar';
import { PetCustomizer } from './components/PetCustomizer';
import { useCompanionStore } from './store/companionStore';
import { SettingsPanel } from './components/SettingsPanel';
import { useProfileStore } from './store/profileStore';
import { FriendsPanel } from './components/FriendsPanel';
import { PlayerMenu } from './components/PlayerMenu';
import { useSocialStore } from './store/socialStore';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const chatOpen = useCompanionStore((s) => s.chatOpen);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const pending = useSocialStore((s) => s.friends.filter((f) => f.status === 'pending' && f.incoming).length + s.invites.length);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);
  const profile = useProfileStore((s) => s.profile);
  const userId = session?.user.id;

  // Load the player's profile on sign-in (for their name tag); forget it on sign-out.
  useEffect(() => {
    if (userId) {
      void useProfileStore.getState().load();
      useSocialStore.getState().start(userId); // presence, friends and parties
    } else {
      useProfileStore.getState().clear();
      useSocialStore.getState().stop();
      setFriendsOpen(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const playerName = profile?.displayName || session?.user.email?.split('@')[0] || 'You';

  return (
    <div className="relative h-full w-full">
      <World playerName={playerName} />
      <div className="pointer-events-none absolute inset-0 z-20 p-4">
        <div className="pointer-events-auto flex max-h-full w-fit flex-col items-start gap-2">
          <AuthBar session={session} />
          <p className="rounded-lg bg-slate-900/70 px-3 py-1.5 text-xs text-slate-200">
            WASD / arrows to move · drag to look · scroll to zoom · tap Echo's bubble to chat
          </p>
          <div className="flex gap-2">
            {session && (
              <button
                type="button"
                aria-expanded={friendsOpen}
                onClick={() => setFriendsOpen(!friendsOpen)}
                className="relative rounded-lg bg-slate-900/80 px-3 py-1.5 text-xs text-slate-100 hover:bg-slate-900"
              >
                👥 Friends
                {pending > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 rounded-full bg-red-500 px-1.5 text-[10px] font-bold" aria-label={`${pending} new`}>
                    {pending}
                  </span>
                )}
              </button>
            )}
            {session && (
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="rounded-lg bg-slate-900/80 px-3 py-1.5 text-xs text-slate-100 hover:bg-slate-900"
              >
                ⚙ Settings
              </button>
            )}
          </div>
          <PetCustomizer />
          {friendsOpen && <FriendsPanel onClose={() => setFriendsOpen(false)} />}
        </div>
        {/* pinned to its own corner so panels on the left can never push it off screen */}
        <div className="absolute bottom-4 right-4 top-4 flex items-end">{chatOpen && <CompanionChat />}</div>
      </div>
      {settingsOpen && <SettingsPanel onClose={closeSettings} />}
      <PlayerMenu />
    </div>
  );
}
