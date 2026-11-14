import { useState, type KeyboardEvent } from 'react';
import { CURATED_TAGS, MAX_TAGS, MAX_TAG_LENGTH, tagKey, toTag } from '../types/tags';

/** Pick community tags from suggestions or type your own. Tags are matched by key, so no near-duplicates. */
export function TagPicker({ tags, onChange, error }: { tags: string[]; onChange: (tags: string[]) => void; error?: string }) {
  const [draft, setDraft] = useState('');
  const [hint, setHint] = useState<string | null>(null);
  const keys = new Set(tags.map(tagKey));
  const full = tags.length >= MAX_TAGS;

  const add = (raw: string) => {
    const tag = toTag(raw);
    if (!tag) return setHint(`Use 2-${MAX_TAG_LENGTH} letters or numbers.`);
    if (keys.has(tagKey(tag))) return setHint(`#${tag} is already added.`);
    if (full) return setHint(`You can have up to ${MAX_TAGS} tags.`);
    onChange([...tags, tag]);
    setDraft('');
    setHint(null);
  };
  const remove = (tag: string) => onChange(tags.filter((t) => tagKey(t) !== tagKey(tag)));
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault(); // don't submit the settings form
      if (draft.trim()) add(draft);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="font-medium text-slate-200">Your tags</span>
          <span className="text-xs text-slate-400">
            {tags.length}/{MAX_TAGS}
          </span>
        </div>
        {tags.length ? (
          <ul className="flex flex-wrap gap-1.5" aria-label="Your tags">
            {tags.map((tag) => (
              <li key={tag} className="flex items-center gap-1 rounded-full bg-indigo-600/80 py-0.5 pl-2.5 pr-1 text-xs">
                #{tag}
                <button type="button" onClick={() => remove(tag)} aria-label={`Remove #${tag}`} className="rounded-full px-1 leading-none hover:bg-white/20">
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-slate-400">No tags yet. Pick some below or add your own.</p>
        )}
      </div>

      <div className="flex gap-2">
        <label htmlFor="tag-input" className="sr-only">
          Add your own tag
        </label>
        <input
          id="tag-input"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setHint(null);
          }}
          onKeyDown={onKey}
          maxLength={MAX_TAG_LENGTH + 10}
          disabled={full}
          placeholder={full ? 'Tag limit reached' : 'Add your own, e.g. #Durham or jazz piano'}
          aria-invalid={error || hint ? true : undefined}
          aria-describedby="tag-hint"
          className="min-w-0 flex-1 rounded-lg bg-white/10 px-3 py-2 outline-none placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-400 disabled:opacity-50"
        />
        <button type="button" onClick={() => add(draft)} disabled={full || !draft.trim()} className="rounded-lg bg-white/10 px-3 py-2 hover:bg-white/20 disabled:opacity-40">
          Add
        </button>
      </div>
      <p id="tag-hint" className={`-mt-2 text-xs ${error || hint ? 'text-red-300' : 'text-slate-400'}`}>
        {error ?? hint ?? 'Press Enter to add. Spaces are joined up: "jazz piano" becomes #JazzPiano.'}
      </p>

      {CURATED_TAGS.map(({ group, tags: suggestions }) => (
        <fieldset key={group}>
          <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{group}</legend>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((tag) => {
              const on = keys.has(tagKey(tag));
              return (
                <button
                  key={tag}
                  type="button"
                  aria-pressed={on}
                  disabled={!on && full}
                  onClick={() => (on ? remove(tag) : add(tag))}
                  className={`rounded-full px-2.5 py-0.5 text-xs transition ${on ? 'bg-indigo-600 text-white' : 'bg-white/10 text-slate-200 hover:bg-white/20'} disabled:opacity-40`}
                >
                  #{tag}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
