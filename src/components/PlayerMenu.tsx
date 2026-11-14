import { useEffect, useRef, useState } from 'react';
import { useSocialStore, type Result } from '../store/socialStore';

/**
 * Right-click menu for another player's avatar. To open it from an avatar (React Three Fiber):
 *
 *   <mesh onContextMenu={(e) => {
 *     e.stopPropagation();
 *     useSocialStore.getState().openPlayerMenu(
 *       { userId, username, displayName }, e.nativeEvent.clientX, e.nativeEvent.clientY);
 *   }} />
 */
export function PlayerMenu() {
  const { menu, me, friends, party, closePlayerMenu, addFriend, inviteToParty } = useSocialStore();
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setResult(null);
    if (!menu) return;
    ref.current?.querySelector('button')?.focus();
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) closePlayerMenu();
    };
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', close);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', close);
    };
  }, [menu, closePlayerMenu]);

  if (!menu || menu.userId === me) return null;
  const friend = friends.find((f) => f.userId === menu.userId);
  const isFriend = friend?.status === 'accepted';
  const inMyParty = party?.members.some((m) => m.userId === menu.userId);

  const run = async (action: () => Promise<Result>) => {
    setBusy(true);
    setResult(await action());
    setBusy(false);
  };

  const item = 'block w-full rounded-md px-3 py-1.5 text-left hover:bg-white/10 disabled:opacity-40';
  return (
    <div
      ref={ref}
      role="menu"
      aria-label={`Actions for ${menu.displayName}`}
      className="pointer-events-auto fixed z-50 w-56 rounded-xl border border-white/10 bg-slate-900/95 p-1.5 text-sm text-slate-100 shadow-xl"
      style={{ left: Math.min(menu.x, window.innerWidth - 232), top: Math.min(menu.y, window.innerHeight - 160) }}
    >
      <p className="truncate px-3 pb-1 pt-0.5 font-semibold">
        {menu.displayName} <span className="font-normal text-slate-400">@{menu.username}</span>
      </p>
      {!isFriend && (
        <button
          type="button"
          role="menuitem"
          disabled={busy || friend?.status === 'pending'}
          onClick={() => void run(() => addFriend(menu.username))}
          className={item}
        >
          {friend?.status === 'pending' ? (friend.incoming ? 'Wants to be your friend (see Friends)' : 'Friend request sent') : '➕ Add friend'}
        </button>
      )}
      {isFriend && party && !inMyParty && (
        <button type="button" role="menuitem" disabled={busy} onClick={() => void run(() => inviteToParty(friend))} className={item}>
          🎉 Invite to party
        </button>
      )}
      {isFriend && (!party || inMyParty) && <p className="px-3 py-1.5 text-xs text-slate-400">{inMyParty ? 'In your party' : 'Friend · create a party to invite them'}</p>}
      {result && <p className={`px-3 py-1 text-xs ${result.ok ? 'text-emerald-300' : 'text-red-300'}`}>{result.message}</p>}
    </div>
  );
}
