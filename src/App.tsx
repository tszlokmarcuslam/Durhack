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

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const chatOpen = useCompanionStore((s) => s.chatOpen);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);
  const profile = useProfileStore((s) => s.profile);
  const userId = session?.user.id;

  // Load the player's profile on sign-in (for their name tag); forget it on sign-out.
  useEffect(() => {
    if (userId) void useProfileStore.getState().load();
    else useProfileStore.getState().clear();
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
      <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-4">
        <div className="pointer-events-auto flex flex-col items-start gap-2 self-start">
          <AuthBar session={session} />
          <p className="rounded-lg bg-slate-900/70 px-3 py-1.5 text-xs text-slate-200">
            WASD / arrows to move · drag to look · scroll to zoom · tap Echo's bubble to chat
          </p>
          <div className="flex gap-2">
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
        </div>
        <div className="self-end">{chatOpen && <CompanionChat />}</div>
      </div>
      {settingsOpen && <SettingsPanel onClose={closeSettings} />}
    </div>
  );
}
