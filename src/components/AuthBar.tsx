import { useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

/** Minimal email/password sign-in so the companion API can authenticate the caller. */
export function AuthBar({ session }: { session: Session | null }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  if (!supabase) {
    return (
      <p className="rounded-lg bg-amber-400/90 px-3 py-1.5 text-xs font-semibold text-amber-950">
        Local dev mode — Supabase not configured (no accounts, no player search)
      </p>
    );
  }
  const client = supabase;

  if (session) {
    return (
      <p className="rounded-lg bg-slate-900/80 px-3 py-1.5 text-xs text-slate-100">
        {session.user.email}{' '}
        <button type="button" className="underline" onClick={() => void client.auth.signOut()}>
          Sign out
        </button>
      </p>
    );
  }

  async function submit(e: FormEvent, mode: 'in' | 'up') {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    const { error } =
      mode === 'in'
        ? await client.auth.signInWithPassword({ email, password })
        : await client.auth.signUp({ email, password });
    setBusy(false);
    if (error) setNotice(error.message);
    else if (mode === 'up') setNotice('Account created. Check your email if confirmation is required.');
  }

  const field = 'rounded bg-white/10 px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-400';
  return (
    <form
      onSubmit={(e) => void submit(e, 'in')}
      className="flex w-64 flex-col gap-2 rounded-xl bg-slate-900/85 p-3 text-xs text-slate-100"
    >
      <p className="font-semibold">Sign in to use your companion</p>
      <input className={field} type="email" required placeholder="Email" aria-label="Email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input className={field} type="password" required minLength={6} placeholder="Password" aria-label="Password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="flex-1 rounded bg-indigo-600 py-1 font-medium disabled:opacity-50">
          Sign in
        </button>
        <button type="button" disabled={busy || !email || password.length < 6} onClick={(e) => void submit(e, 'up')} className="flex-1 rounded bg-white/10 py-1 disabled:opacity-50">
          Sign up
        </button>
      </div>
      {notice && <p role="status" className="text-amber-200">{notice}</p>}
    </form>
  );
}
