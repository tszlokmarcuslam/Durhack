import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import { useCompanionStore } from '../store/companionStore';
import type { PublicPlayer } from '../types/companion';

function subscribeOnline(cb: () => void) {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
}

function PlayerCard({ player }: { player: PublicPlayer }) {
  const education = [player.subject, player.university].filter(Boolean).join(' · ');
  return (
    <li className="rounded-lg border border-white/10 bg-white/5 p-2 text-xs">
      <p className="font-semibold text-white">
        {player.displayName} <span className="font-normal text-slate-400">@{player.username}</span>
      </p>
      {education && <p className="text-slate-300">{education}</p>}
      {player.city && <p className="text-slate-300">{player.city}</p>}
      {player.interests && <p className="text-slate-400">{player.interests.join(', ')}</p>}
    </li>
  );
}

export function CompanionChat() {
  const { messages, status, error, send, retry, setChatOpen } = useCompanionStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine);
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const thinking = status === 'thinking';

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setChatOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setChatOpen]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, thinking, error]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!draft.trim() || thinking) return;
    void send(draft);
    setDraft('');
  }

  return (
    <section
      aria-label="Companion chat"
      className="pointer-events-auto flex h-[26rem] max-h-full w-80 max-w-[calc(100vw-2rem)] flex-col rounded-2xl border border-white/10 bg-slate-900/85 text-sm text-slate-100 shadow-xl backdrop-blur"
    >
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-2">
        <h2 className="font-semibold">🐾 Echo, your companion</h2>
        <div className="flex items-center gap-2">
          {!online && <span className="rounded bg-red-500/20 px-2 py-0.5 text-xs text-red-300">Offline</span>}
          <button
            type="button"
            onClick={() => setChatOpen(false)}
            aria-label="Close chat"
            className="rounded px-2 text-lg leading-none text-slate-400 hover:bg-white/10 hover:text-white"
          >
            ×
          </button>
        </div>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3" aria-live="polite">
        {messages.length === 0 && !error && (
          <p className="text-slate-400">
            Say hi, ask for advice, or try: “Find someone from Manchester who studies maths.”
          </p>
        )}

        {messages.map((m) => (
          <div key={m.id} className={m.role === 'user' ? 'text-right' : ''}>
            <p
              className={`inline-block max-w-[90%] whitespace-pre-wrap rounded-xl px-3 py-2 text-left ${
                m.role === 'user' ? 'bg-indigo-600' : 'bg-white/10'
              }`}
            >
              {m.devMode && (
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-amber-300">
                  Local dev mode — not an AI reply
                </span>
              )}
              {m.text}
            </p>
            {m.players && m.players.length > 0 && (
              <ul className="mt-2 space-y-1 text-left">
                {m.players.map((p) => (
                  <PlayerCard key={p.id} player={p} />
                ))}
              </ul>
            )}
          </div>
        ))}

        {thinking && <p className="animate-pulse text-slate-400">Echo is thinking…</p>}

        {error && (
          <div role="alert" className="rounded-lg border border-red-400/30 bg-red-500/10 p-2 text-red-200">
            <p>{error.message}</p>
            {error.kind !== 'unauthenticated' && error.kind !== 'not_configured' && (
              <button type="button" onClick={() => void retry()} className="mt-1 underline">
                Try again
              </button>
            )}
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={onSubmit} className="flex gap-2 border-t border-white/10 p-3">
        <label htmlFor="companion-input" className="sr-only">
          Message your companion
        </label>
        <input
          id="companion-input"
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={1000}
          placeholder={online ? 'Message Echo…' : 'You are offline'}
          disabled={!online}
          autoComplete="off"
          className="min-w-0 flex-1 rounded-lg bg-white/10 px-3 py-2 outline-none placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-400 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!online || thinking || !draft.trim()}
          className="rounded-lg bg-indigo-600 px-3 py-2 font-medium disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </section>
  );
}
