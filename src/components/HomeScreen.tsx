import { useState, type FormEvent, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { usePetStore } from '../store/petStore';
import { useProfileStore } from '../store/profileStore';
import { useSocialStore, type Result } from '../store/socialStore';
import { USERNAME_PATTERN } from '../types/social';
import { AuthBar } from './AuthBar';

// Palette and type from Damon's Nook home screen design (design/nook-home-screen).
const C = { bg: '#F3EEE6', card: '#FBF8F1', olive: '#5E683C', ink: '#2B2A27', muted: '#6B665E', chip: '#ECE6D9', offline: '#B8B0A2' };

type Menu = 'call' | 'friends' | 'world' | 'settings' | null;
const TITLES: Record<Exclude<Menu, null>, string> = { call: 'Call', friends: 'Friends', world: 'World', settings: 'Settings' };

const Chevron = ({ back }: { back?: boolean }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={back ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'} />
  </svg>
);

const ICONS: Record<Exclude<Menu, null>, ReactNode> = {
  call: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />,
  friends: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.5-3.5 3-5.5 6.5-5.5s6 2 6.5 5.5" />
      <path d="M16 4.8a3.5 3.5 0 0 1 0 6.4M18.5 14.8c1.8.8 2.8 2.6 3 5.2" />
    </>
  ),
  world: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
    </>
  ),
};

const bigButton =
  'flex h-[clamp(52px,9vh,66px)] w-full shrink-0 items-center gap-3.5 rounded-[20px] border border-[#2B2A27]/[.07] text-left text-xl font-semibold shadow-[0_8px_22px_rgba(43,42,39,.1)] transition hover:-translate-y-0.5 active:translate-y-px disabled:pointer-events-none disabled:opacity-50';

function MenuButton({ menu, primary, badge, onClick }: { menu: Exclude<Menu, null>; primary?: boolean; badge?: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${bigButton} pl-3 pr-[18px] ${primary ? 'bg-[#5E683C] text-[#F8F4EC] shadow-[0_10px_26px_rgba(60,66,38,.28)]' : 'bg-[#FBF8F1] text-[#2B2A27]'}`}
    >
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] ${primary ? 'bg-[#F8F4EC]/15' : 'bg-[#ECE6D9]'}`}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          {ICONS[menu]}
        </svg>
      </span>
      <span className="flex-1">{TITLES[menu]}</span>
      {!!badge && <span className="rounded-full bg-[#8A4B2E] px-2 text-sm text-white" aria-label={`${badge} new`}>{badge}</span>}
      <span className={primary ? 'opacity-70' : 'text-[#6B665E]'}>
        <Chevron />
      </span>
    </button>
  );
}

function ItemButton({ children, primary, onClick, disabled }: { children: ReactNode; primary?: boolean; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${bigButton} justify-center ${primary ? 'bg-[#5E683C] text-[#F8F4EC]' : 'bg-[#FBF8F1] text-[#2B2A27]'}`}
    >
      {children}
    </button>
  );
}

const Initial = ({ name }: { name: string }) => (
  <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-[#E4E6D2] font-semibold text-[#5E683C]" aria-hidden>
    {name.trim()[0]?.toUpperCase() ?? '?'}
  </span>
);

const Note = ({ children }: { children: ReactNode }) => <p className="px-2 text-center text-[15px] text-[#6B665E]">{children}</p>;

function FriendsMenu({ onOpenPanel }: { onOpenPanel: (tab: 'friends' | 'party') => void }) {
  const { friends, online, invites, loaded, loadError, addFriend } = useSocialStore();
  const [adding, setAdding] = useState(false);
  const [username, setUsername] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const accepted = friends.filter((f) => f.status === 'accepted').sort((a, b) => Number(online.has(b.userId)) - Number(online.has(a.userId)));
  const requests = friends.filter((f) => f.status === 'pending' && f.incoming).length;

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    const name = username.trim().replace(/^@/, '');
    if (!USERNAME_PATTERN.test(name)) return setResult({ ok: false, message: 'Usernames are 3-24 letters, numbers or _.' });
    const r = await addFriend(name);
    setResult(r);
    if (r.ok) setUsername('');
  }

  return (
    <>
      {!loaded ? (
        <Note>Loading friends…</Note>
      ) : loadError ? (
        <Note>{loadError}</Note>
      ) : accepted.length ? (
        <ul className="flex min-h-0 flex-col gap-1.5 overflow-auto">
          {accepted.map((f) => {
            const on = online.has(f.userId);
            return (
              <li key={f.userId} className="flex h-[50px] shrink-0 items-center gap-3 rounded-2xl border border-[#2B2A27]/[.07] bg-[#FBF8F1] pl-2 pr-3.5">
                <Initial name={f.displayName} />
                <span className="min-w-0 flex-1 truncate text-base font-semibold">{f.displayName}</span>
                <span className="text-[13px] text-[#6B665E]">{on ? 'Online' : 'Offline'}</span>
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: on ? C.olive : C.offline }} />
              </li>
            );
          })}
        </ul>
      ) : (
        <Note>No friends yet. Add someone by their username.</Note>
      )}

      {adding ? (
        <form onSubmit={(e) => void onAdd(e)} className="flex shrink-0 gap-2">
          <label htmlFor="home-add-friend" className="sr-only">
            Friend's username
          </label>
          <input
            id="home-add-friend"
            autoFocus
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setResult(null);
            }}
            placeholder="Their username"
            autoComplete="off"
            maxLength={25}
            className="min-w-0 flex-1 rounded-[20px] border border-[#2B2A27]/10 bg-white px-4 text-lg outline-none focus:ring-2 focus:ring-[#5E683C]"
          />
          <button type="submit" disabled={!username.trim()} className="rounded-[20px] bg-[#5E683C] px-5 py-3.5 text-lg font-semibold text-[#F8F4EC] disabled:opacity-50">
            Add
          </button>
        </form>
      ) : (
        <ItemButton onClick={() => setAdding(true)}>Add a friend</ItemButton>
      )}
      {result && (
        <p role="status" className={`text-center text-sm ${result.ok ? 'text-[#5E683C]' : 'text-[#8A4B2E]'}`}>
          {result.message}
        </p>
      )}
      <ItemButton onClick={() => onOpenPanel(requests || invites.length ? 'friends' : 'party')}>
        {requests + invites.length ? `Requests & parties (${requests + invites.length})` : 'Parties & requests'}
      </ItemButton>
    </>
  );
}

export function HomeScreen({
  session,
  onEnterWorld,
  onOpenSettings,
  onOpenFriends,
}: {
  session: Session | null;
  onEnterWorld: () => void;
  onOpenSettings: () => void;
  onOpenFriends: (tab: 'friends' | 'party') => void;
}) {
  const [menu, setMenu] = useState<Menu>(null);
  const profile = useProfileStore((s) => s.profile);
  const pet = usePetStore();
  const pending = useSocialStore((s) => s.friends.filter((f) => f.status === 'pending' && f.incoming).length + s.invites.length);
  const signedIn = !!session;
  const needsSignIn = !!supabase && !signedIn;
  const name = profile?.displayName || session?.user.email?.split('@')[0] || 'Your name';

  return (
    <div className="pointer-events-none absolute inset-0 z-30 text-[#2B2A27]" style={{ fontFamily: "'Figtree', system-ui, sans-serif" }}>
      {/* soft veil over the world behind, as in the design */}
      <div
        className="absolute inset-0"
        style={{ background: `radial-gradient(ellipse 75% 85% at 50% 50%, rgba(243,238,230,.96), rgba(243,238,230,.62) 68%, rgba(243,238,230,.45))` }}
      />

      <header className="absolute left-6 right-6 top-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <svg width="34" height="34" viewBox="0 0 32 32" fill="none" aria-hidden>
            <rect width="32" height="32" rx="10" fill={C.olive} />
            <path d="M10 23v-8a6 6 0 0 1 12 0v8" stroke="#F8F4EC" strokeWidth="3.2" strokeLinecap="round" />
            <circle cx="16" cy="21.5" r="2" fill="#F8F4EC" />
          </svg>
          <h1 className="flex items-baseline gap-1.5 text-[25px] tracking-[-.02em]">
            <span className="font-bold">echo</span>
            <span className="font-medium text-[#5E683C]">world</span>
          </h1>
        </div>
        {signedIn && (
          <button
            type="button"
            onClick={onOpenSettings}
            title="Edit your profile"
            className="pointer-events-auto flex h-11 items-center gap-2.5 rounded-full border border-[#2B2A27]/[.07] bg-[#FBF8F1] pl-1.5 pr-3.5 text-[15px] font-semibold shadow-[0_6px_18px_rgba(43,42,39,.1)] transition hover:-translate-y-px"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E4E6D2] text-[#5E683C]">{name[0]?.toUpperCase()}</span>
            <span className="max-w-40 truncate">{name}</span>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M4 20l1-4.5L16.5 4a2.1 2.1 0 0 1 3 3L8 18.5 4 20z" />
            </svg>
          </button>
        )}
      </header>

      {!supabase && (
        <p className="absolute left-1/2 top-20 -translate-x-1/2 rounded-full bg-[#F2D9A6] px-4 py-1 text-sm font-semibold text-[#6B4A12]">
          Local dev mode — accounts, friends and search are off
        </p>
      )}

      <nav
        aria-label="Main menu"
        className="pointer-events-auto absolute left-1/2 top-1/2 flex max-h-[calc(100%-150px)] w-[min(360px,calc(100vw-48px))] -translate-x-1/2 -translate-y-1/2 flex-col gap-2.5"
      >
        {needsSignIn ? (
          <AuthBar session={session} tone="light" />
        ) : menu === null ? (
          <>
            <MenuButton menu="call" primary onClick={() => setMenu('call')} />
            <MenuButton menu="friends" badge={pending} onClick={() => setMenu('friends')} />
            <MenuButton menu="world" onClick={() => setMenu('world')} />
            <MenuButton menu="settings" onClick={() => setMenu('settings')} />
          </>
        ) : (
          <>
            <h2 className="pb-1.5 text-center text-[28px] font-bold tracking-[-.02em]">{TITLES[menu]}</h2>

            {menu === 'call' && (
              <>
                <Note>Voice calls are coming soon. Until then, start a party and meet your friends in the world.</Note>
                <ItemButton primary disabled>
                  Start a call · soon
                </ItemButton>
                <ItemButton onClick={() => onOpenFriends('party')} disabled={!signedIn}>
                  Start a party
                </ItemButton>
              </>
            )}

            {menu === 'friends' && (signedIn ? <FriendsMenu onOpenPanel={onOpenFriends} /> : <Note>Friends need an account.</Note>)}

            {menu === 'world' && (
              <>
                <Note>Walk around, meet people, and chat with Echo, your AI companion.</Note>
                <ItemButton primary onClick={onEnterWorld}>
                  Join the world
                </ItemButton>
              </>
            )}

            {menu === 'settings' && (
              <>
                <ItemButton onClick={onOpenSettings} disabled={!signedIn}>
                  Profile, tags &amp; privacy
                </ItemButton>
                <ItemButton onClick={() => pet.set({ voiceEnabled: !pet.voiceEnabled })}>Echo's voice: {pet.voiceEnabled ? 'On' : 'Off'}</ItemButton>
                {signedIn && <ItemButton onClick={() => void supabase?.auth.signOut()}>Sign out</ItemButton>}
              </>
            )}

            <button
              type="button"
              onClick={() => setMenu(null)}
              className="mt-2 flex h-[clamp(46px,8vh,56px)] shrink-0 items-center justify-center gap-2 rounded-[20px] border-[1.5px] border-[#2B2A27]/20 bg-[#FBF8F1]/70 text-lg font-semibold transition hover:bg-[#FBF8F1]"
            >
              <Chevron back />
              Back
            </button>
          </>
        )}
      </nav>
    </div>
  );
}
