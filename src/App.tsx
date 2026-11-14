import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { World } from './world/World';
import { CompanionChat } from './components/CompanionChat';
import { AuthBar } from './components/AuthBar';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const playerName = session?.user.email?.split('@')[0] ?? 'You';

  return (
    <div className="relative h-full w-full">
      <World playerName={playerName} />
      <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-4">
        <div className="pointer-events-auto flex flex-col items-start gap-2 self-start">
          <AuthBar session={session} />
          <p className="rounded-lg bg-slate-900/70 px-3 py-1.5 text-xs text-slate-200">
            WASD / arrows to move · drag to look · scroll to zoom
          </p>
        </div>
        <div className="self-end">
          <CompanionChat />
        </div>
      </div>
    </div>
  );
}
