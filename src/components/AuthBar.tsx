import { useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

/** Minimal email/password sign-in so the companion API can authenticate the caller. */
export function AuthBar({ session, tone = 'dark' }: { session: Session | null; tone?: 'dark' | 'light' }) {
  const light = tone === 'light';
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

  const field = light
    ? 'rounded-xl border border-[#2B2A27]/10 bg-white px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-[#5E683C]'
    : 'rounded bg-white/10 px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-400';
  return (
    <form
      onSubmit={(e) => void submit(e, 'in')}
      className={
        light
          ? 'flex w-full flex-col gap-2.5 rounded-3xl border border-[#2B2A27]/[.07] bg-[#FBF8F1] p-5 text-[#2B2A27] shadow-[0_8px_22px_rgba(43,42,39,.1)]'
          : 'flex w-64 flex-col gap-2 rounded-xl bg-slate-900/85 p-3 text-xs text-slate-100'
      }
    >
      <p className={light ? 'text-center text-lg font-semibold' : 'font-semibold'}>{light ? 'Sign in to get started' : 'Sign in to use your companion'}</p>
      <input className={field} type="email" required placeholder="Email" aria-label="Email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input className={field} type="password" required minLength={6} placeholder="Password" aria-label="Password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className={`flex-1 font-medium disabled:opacity-50 ${light ? 'rounded-xl bg-[#5E683C] py-2.5 text-[#F8F4EC]' : 'rounded bg-indigo-600 py-1'}`}>
          Sign in
        </button>
        <button
          type="button"
          disabled={busy || !email || password.length < 6}
          onClick={(e) => void submit(e, 'up')}
          className={`flex-1 disabled:opacity-50 ${light ? 'rounded-xl bg-[#ECE6D9] py-2.5 font-medium' : 'rounded bg-white/10 py-1'}`}
        >
          Sign up
        </button>
      </div>
      {notice && <p role="status" className={light ? 'text-sm text-[#8A4B2E]' : 'text-amber-200'}>{notice}</p>}
    </form>
  );
}
