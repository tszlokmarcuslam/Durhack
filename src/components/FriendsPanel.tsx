import { useState, type FormEvent, type ReactNode } from 'react';
import { useSocialStore, type Result } from '../store/socialStore';
import { ACTIVITIES, USERNAME_PATTERN, type Activity, type Friend } from '../types/social';

function OnlineDot({ online }: { online: boolean }) {
  return (
    <span
      className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${online ? 'bg-emerald-400' : 'bg-slate-600'}`}
      role="img"
      aria-label={online ? 'Online' : 'Offline'}
    />
  );
}

function Row({ children }: { children: ReactNode }) {
  return <li className="flex items-center gap-2 rounded-lg bg-white/5 px-2.5 py-1.5">{children}</li>;
}

function Name({ displayName, username }: { displayName: string; username: string }) {
  return (
    <span className="min-w-0 flex-1 truncate">
      {displayName} <span className="text-slate-400">@{username}</span>
    </span>
  );
}

const small = 'rounded-md px-2 py-0.5 text-xs disabled:opacity-40';

function Heading({ children }: { children: ReactNode }) {
  return <h3 className="mb-1.5 mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400 first:mt-0">{children}</h3>;
}

export function FriendsPanel({ onClose, initialTab = 'friends' }: { onClose: () => void; initialTab?: 'friends' | 'party' }) {
  const s = useSocialStore();
  const [tab, setTab] = useState<'friends' | 'party'>(initialTab);
  const [username, setUsername] = useState('');
  const [notice, setNotice] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [activity, setActivity] = useState<Activity>('study');

  const run = async (action: () => Promise<Result>) => {
    setBusy(true);
    setNotice(await action());
    setBusy(false);
  };

  const accepted = s.friends.filter((f) => f.status === 'accepted');
  const incoming = s.friends.filter((f) => f.status === 'pending' && f.incoming);
  const outgoing = s.friends.filter((f) => f.status === 'pending' && !f.incoming);
  const online = accepted.filter((f) => s.online.has(f.userId));
  const offline = accepted.filter((f) => !s.online.has(f.userId));
  const inParty = new Set(s.party?.members.map((m) => m.userId));
  const isLeader = s.party?.leader === s.me;

  function onAdd(e: FormEvent) {
    e.preventDefault();
    const name = username.trim().replace(/^@/, '');
    if (!USERNAME_PATTERN.test(name)) return setNotice({ ok: false, message: 'Usernames are 3-24 letters, numbers or _.' });
    void run(async () => {
      const result = await s.addFriend(name);
      if (result.ok) setUsername('');
      return result;
    });
  }

  const friendRow = (f: Friend) => (
    <Row key={f.userId}>
      <OnlineDot online={s.online.has(f.userId)} />
      <Name displayName={f.displayName} username={f.username} />
      {s.party && !inParty.has(f.userId) && (
        <button type="button" disabled={busy} onClick={() => void run(() => s.inviteToParty(f))} className={`${small} bg-indigo-600`}>
          Invite
        </button>
      )}
      {confirmRemove === f.userId ? (
        <button type="button" disabled={busy} onClick={() => void run(() => s.removeFriend(f))} className={`${small} bg-red-600`}>
          Remove?
        </button>
      ) : (
        <button type="button" onClick={() => setConfirmRemove(f.userId)} aria-label={`Remove ${f.displayName}`} className={`${small} text-slate-400 hover:bg-white/10`}>
          ×
        </button>
      )}
    </Row>
  );

  return (
    <section
      aria-label="Friends and party"
      className="pointer-events-auto flex min-h-0 max-h-[34rem] w-80 flex-col rounded-2xl border border-white/10 bg-slate-900/90 text-sm text-slate-100 shadow-xl backdrop-blur"
    >
      <header className="flex items-center gap-1 border-b border-white/10 px-3 py-2">
        {(['friends', 'party'] as const).map((t) => {
          const badge = t === 'friends' ? incoming.length : s.invites.length;
          return (
            <button
              key={t}
              type="button"
              aria-pressed={tab === t}
              onClick={() => setTab(t)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1 ${tab === t ? 'bg-indigo-600' : 'text-slate-300 hover:bg-white/10'}`}
            >
              {t === 'friends' ? `Friends (${online.length} online)` : 'Party'}
              {badge > 0 && <span className="rounded-full bg-red-500 px-1.5 text-[10px] font-bold">{badge}</span>}
            </button>
          );
        })}
        <button type="button" onClick={onClose} aria-label="Close friends" className="ml-auto rounded px-2 text-lg leading-none text-slate-400 hover:bg-white/10 hover:text-white">
          ×
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {!s.loaded ? (
          <p className="text-slate-400">Loading…</p>
        ) : s.loadError ? (
          <div role="alert" className="text-red-200">
            <p>{s.loadError}</p>
            <button type="button" onClick={() => void s.refresh()} className="mt-1 underline">
              Try again
            </button>
          </div>
        ) : tab === 'friends' ? (
          <>
            <form onSubmit={onAdd} className="flex gap-2">
              <label htmlFor="friend-username" className="sr-only">
                Add a friend by username
              </label>
              <input
                id="friend-username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setNotice(null);
                }}
                placeholder="Add by username, e.g. ada_l"
                autoComplete="off"
                maxLength={25}
                className="min-w-0 flex-1 rounded-lg bg-white/10 px-3 py-1.5 outline-none placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-400"
              />
              <button type="submit" disabled={busy || !username.trim()} className="rounded-lg bg-indigo-600 px-3 py-1.5 font-medium disabled:opacity-40">
                Add
              </button>
            </form>
            <p className="mb-3 mt-1 text-xs text-slate-400">Or right-click another player's avatar.</p>

            {incoming.length > 0 && (
              <>
                <Heading>Friend requests</Heading>
                <ul className="space-y-1">
                  {incoming.map((f) => (
                    <Row key={f.userId}>
                      <Name displayName={f.displayName} username={f.username} />
                      <button type="button" disabled={busy} onClick={() => void run(() => s.respondToRequest(f, true))} className={`${small} bg-emerald-600`}>
                        Accept
                      </button>
                      <button type="button" disabled={busy} onClick={() => void run(() => s.respondToRequest(f, false))} className={`${small} bg-white/10`}>
                        Decline
                      </button>
                    </Row>
                  ))}
                </ul>
              </>
            )}

            <Heading>Online — {online.length}</Heading>
            {online.length ? <ul className="space-y-1">{online.map(friendRow)}</ul> : <p className="text-xs text-slate-400">No friends online right now.</p>}

            {offline.length > 0 && (
              <>
                <Heading>Offline — {offline.length}</Heading>
                <ul className="space-y-1 opacity-70">{offline.map(friendRow)}</ul>
              </>
            )}

            {accepted.length === 0 && incoming.length === 0 && (
              <p className="mt-3 text-xs text-slate-400">No friends yet. Add someone by username, or ask Echo to find people with your interests.</p>
            )}

            {outgoing.length > 0 && (
              <>
                <Heading>Sent requests</Heading>
                <ul className="space-y-1">
                  {outgoing.map((f) => (
                    <Row key={f.userId}>
                      <Name displayName={f.displayName} username={f.username} />
                      <button type="button" disabled={busy} onClick={() => void run(() => s.removeFriend(f))} className={`${small} bg-white/10`}>
                        Cancel
                      </button>
                    </Row>
                  ))}
                </ul>
              </>
            )}
          </>
        ) : (
          <>
            {s.invites.length > 0 && (
              <>
                <Heading>Party invites</Heading>
                <ul className="mb-2 space-y-1">
                  {s.invites.map((i) => (
                    <Row key={i.inviteId}>
                      <span className="min-w-0 flex-1">
                        {ACTIVITIES[i.activity].icon} <strong>{i.inviterDisplayName}</strong>
                        <span className="block text-xs text-slate-400">
                          {ACTIVITIES[i.activity].label} · {i.memberCount} {i.memberCount === 1 ? 'member' : 'members'}
                        </span>
                      </span>
                      <button type="button" disabled={busy} onClick={() => void run(() => s.respondToInvite(i, true))} className={`${small} bg-emerald-600`}>
                        Join
                      </button>
                      <button type="button" disabled={busy} onClick={() => void run(() => s.respondToInvite(i, false))} className={`${small} bg-white/10`}>
                        Decline
                      </button>
                    </Row>
                  ))}
                </ul>
                {s.party && <p className="mb-2 text-xs text-slate-400">Joining another party will make you leave your current one.</p>}
              </>
            )}

            {s.party ? (
              <>
                <Heading>Your party</Heading>
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-lg" aria-hidden>
                    {ACTIVITIES[s.party.activity].icon}
                  </span>
                  {isLeader ? (
                    <>
                      <label htmlFor="party-activity" className="sr-only">
                        Party activity
                      </label>
                      <select
                        id="party-activity"
                        value={s.party.activity}
                        disabled={busy}
                        onChange={(e) => void run(() => s.setActivity(e.target.value as Activity))}
                        className="flex-1 rounded-lg bg-white/10 px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-400 [&>option]:text-slate-900"
                      >
                        {Object.entries(ACTIVITIES).map(([key, a]) => (
                          <option key={key} value={key}>
                            {a.label}
                          </option>
                        ))}
                      </select>
                    </>
                  ) : (
                    <span className="font-medium">{ACTIVITIES[s.party.activity].label}</span>
                  )}
                </div>
                <ul className="space-y-1">
                  {s.party.members.map((m) => (
                    <Row key={m.userId}>
                      <OnlineDot online={s.online.has(m.userId)} />
                      <Name displayName={m.userId === s.me ? `${m.displayName} (you)` : m.displayName} username={m.username} />
                      {m.userId === s.party?.leader && (
                        <span title="Party leader" aria-label="Party leader">
                          👑
                        </span>
                      )}
                    </Row>
                  ))}
                </ul>

                <Heading>Invite friends</Heading>
                {accepted.filter((f) => !inParty.has(f.userId)).length ? (
                  <ul className="space-y-1">
                    {[...online, ...offline]
                      .filter((f) => !inParty.has(f.userId))
                      .map((f) => (
                        <Row key={f.userId}>
                          <OnlineDot online={s.online.has(f.userId)} />
                          <Name displayName={f.displayName} username={f.username} />
                          <button type="button" disabled={busy} onClick={() => void run(() => s.inviteToParty(f))} className={`${small} bg-indigo-600`}>
                            Invite
                          </button>
                        </Row>
                      ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-400">All your friends are already here, or you haven't added any yet.</p>
                )}

                <button type="button" disabled={busy} onClick={() => void run(() => s.leaveParty())} className="mt-4 w-full rounded-lg bg-white/10 py-1.5 hover:bg-red-600/60 disabled:opacity-40">
                  Leave party
                </button>
              </>
            ) : (
              <>
                <Heading>Start a party</Heading>
                <p className="mb-2 text-xs text-slate-400">Pick an activity, then invite friends to join you.</p>
                <div className="flex gap-2">
                  <label htmlFor="new-party-activity" className="sr-only">
                    Activity
                  </label>
                  <select
                    id="new-party-activity"
                    value={activity}
                    onChange={(e) => setActivity(e.target.value as Activity)}
                    className="flex-1 rounded-lg bg-white/10 px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-400 [&>option]:text-slate-900"
                  >
                    {Object.entries(ACTIVITIES).map(([key, a]) => (
                      <option key={key} value={key}>
                        {a.icon} {a.label}
                      </option>
                    ))}
                  </select>
                  <button type="button" disabled={busy} onClick={() => void run(() => s.createParty(activity))} className="rounded-lg bg-indigo-600 px-3 py-1.5 font-medium disabled:opacity-40">
                    Create
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {notice && (
        <p role="status" className={`border-t border-white/10 px-3 py-2 text-xs ${notice.ok ? 'text-emerald-300' : 'text-red-300'}`}>
          {notice.message}
        </p>
      )}
    </section>
  );
}
