import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { toPublicPlayer } from '../../server/lib/playerSearch'; // pure privacy projection, shared with search
import { useProfileStore } from '../store/profileStore';
import { emptyProfile, LIMITS, SOCIAL_KEYS, toRow, validateProfile, type ProfileErrors, type ProfileForm } from '../types/profile';
import { PlayerCard } from './CompanionChat';
import { TagPicker } from './TagPicker';

const SOCIAL_LABELS = { website: 'Website', github: 'GitHub', linkedin: 'LinkedIn', instagram: 'Instagram' } as const;
const input =
  'w-full rounded-lg bg-white/10 px-3 py-2 outline-none placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-400 aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-red-400';

const CATEGORIES = [
  { id: 'profile', label: 'Profile', icon: '👤' },
  { id: 'tags', label: 'Tags', icon: '#' },
  { id: 'privacy', label: 'Privacy', icon: '🔒' },
] as const;
type Category = (typeof CATEGORIES)[number]['id'];

/** Which category each field lives in, so a failed save can jump to the first problem. */
const FIELD_CATEGORY: Partial<Record<keyof ProfileErrors, Category>> = {
  displayName: 'profile',
  username: 'profile',
  bio: 'profile',
  website: 'profile',
  github: 'profile',
  linkedin: 'profile',
  instagram: 'profile',
  city: 'tags',
  university: 'tags',
  subject: 'tags',
  tags: 'tags',
};

function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-medium text-slate-200">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-red-300">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-slate-400">{hint}</p>
      )}
    </div>
  );
}

function Toggle({ checked, onChange, label, hint, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint: string; disabled?: boolean }) {
  return (
    <label className={`flex items-start gap-3 rounded-lg bg-white/5 p-3 ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
      <input type="checkbox" className="mt-1 h-4 w-4 accent-indigo-500" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="block font-medium text-slate-100">{label}</span>
        <span className="block text-xs text-slate-400">{hint}</span>
      </span>
    </label>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="font-semibold uppercase tracking-wide text-slate-400">{title}</h3>
      {children}
    </section>
  );
}

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const { profile, status, loadError, load, save } = useProfileStore();
  const [form, setForm] = useState<ProfileForm>(emptyProfile);
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [category, setCategory] = useState<Category>('profile');
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (status === 'loaded') setForm(profile ?? emptyProfile());
  }, [status, profile]);
  useEffect(() => {
    dialog.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const saved = profile ?? emptyProfile();
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const preview = useMemo(() => toPublicPlayer({ ...toRow('preview', form) }), [form]);

  const set = <K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors(({ [key]: _fixed, ...rest }) => rest); // an edited field is no longer flagged
    setNotice(null);
  };
  const text = (key: 'username' | 'displayName' | 'city' | 'university' | 'subject' | 'bio') => ({
    id: `profile-${key}`,
    value: form[key],
    onChange: (e: { target: { value: string } }) => set(key, e.target.value),
    'aria-invalid': errors[key] ? true : undefined,
    'aria-describedby': errors[key] ? `profile-${key}-error` : undefined,
    className: input,
  });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const found = validateProfile(form);
    setErrors(found);
    const first = (Object.keys(found) as (keyof ProfileErrors)[])[0];
    if (first) {
      setCategory(FIELD_CATEGORY[first] ?? category);
      return setNotice({ kind: 'error', text: 'Fix the highlighted fields.' });
    }
    setSaving(true);
    const error = await save(form);
    setSaving(false);
    setNotice(error ? { kind: 'error', text: error } : { kind: 'ok', text: 'Saved.' });
  }

  const hasErrors = (c: Category) => Object.keys(errors).some((k) => FIELD_CATEGORY[k as keyof ProfileErrors] === c);

  return (
    <div className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        tabIndex={-1}
        className="flex h-[min(42rem,100%)] w-full max-w-4xl flex-col rounded-2xl border border-white/10 bg-slate-900 text-sm text-slate-100 shadow-2xl outline-none"
      >
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-3">
          <h2 id="settings-title" className="text-base font-semibold">
            Settings
          </h2>
          <button type="button" onClick={onClose} aria-label="Close settings" className="rounded px-2 text-xl leading-none text-slate-400 hover:bg-white/10 hover:text-white">
            ×
          </button>
        </header>

        {status === 'loading' || status === 'idle' ? (
          <p className="p-6 text-slate-400">Loading your profile…</p>
        ) : status === 'error' ? (
          <div role="alert" className="flex flex-col items-start gap-2 p-6 text-red-200">
            <p>{loadError}</p>
            <button type="button" onClick={() => void load()} className="underline">
              Try again
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
            <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
              <nav aria-label="Settings categories" className="flex shrink-0 gap-1 border-white/10 p-3 sm:w-40 sm:flex-col sm:border-r">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategory(c.id)}
                    aria-current={category === c.id ? 'page' : undefined}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-left ${category === c.id ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-white/10'}`}
                  >
                    <span aria-hidden className="w-4 text-center">
                      {c.icon}
                    </span>
                    {c.label}
                    {hasErrors(c.id) && <span className="ml-auto h-2 w-2 rounded-full bg-red-400" aria-label="has errors" />}
                  </button>
                ))}
              </nav>

              <div className="grid min-h-0 flex-1 gap-6 overflow-y-auto p-5 lg:grid-cols-[1fr_14rem]">
                <div className="flex flex-col gap-6">
                  {!profile && (
                    <p className="rounded-lg bg-indigo-500/15 p-3 text-indigo-100">
                      Welcome! Set up your profile so other players know who you are. Nothing is shared until you switch it on under Privacy.
                    </p>
                  )}

                  {category === 'profile' && (
                    <>
                      <Section title="Profile">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field id="profile-displayName" label="Display name" error={errors.displayName}>
                            <input {...text('displayName')} maxLength={LIMITS.displayName} autoComplete="nickname" />
                          </Field>
                          <Field id="profile-username" label="Username" hint="3-24 letters, numbers or _" error={errors.username}>
                            <input {...text('username')} maxLength={24} autoComplete="username" />
                          </Field>
                        </div>
                        <Field id="profile-bio" label="Short bio" hint={`${form.bio.length}/${LIMITS.bio}`} error={errors.bio}>
                          <textarea {...text('bio')} rows={3} maxLength={LIMITS.bio} />
                        </Field>
                      </Section>
                      <Section title="Social links (optional)">
                        <p className="-mt-2 text-xs text-slate-400">Not shown in player search yet.</p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {SOCIAL_KEYS.map((key) => (
                            <Field key={key} id={`profile-${key}`} label={SOCIAL_LABELS[key]} error={errors[key]}>
                              <input
                                id={`profile-${key}`}
                                type="url"
                                inputMode="url"
                                placeholder="https://"
                                maxLength={LIMITS.link}
                                value={form.social[key]}
                                onChange={(e) => {
                                  set('social', { ...form.social, [key]: e.target.value });
                                  setErrors(({ [key]: _fixed, ...rest }) => rest);
                                }}
                                aria-invalid={errors[key] ? true : undefined}
                                aria-describedby={errors[key] ? `profile-${key}-error` : undefined}
                                className={input}
                              />
                            </Field>
                          ))}
                        </div>
                      </Section>
                    </>
                  )}

                  {category === 'tags' && (
                    <>
                      <Section title="Where you study">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field id="profile-university" label="University" error={errors.university}>
                            <input {...text('university')} maxLength={LIMITS.place} />
                          </Field>
                          <Field id="profile-subject" label="Course / subject" error={errors.subject}>
                            <input {...text('subject')} maxLength={LIMITS.place} placeholder="e.g. Mathematics" />
                          </Field>
                          <Field id="profile-city" label="City (optional)" error={errors.city}>
                            <input {...text('city')} maxLength={LIMITS.place} placeholder="e.g. Durham" />
                          </Field>
                        </div>
                      </Section>
                      <Section title="Community tags">
                        <p className="-mt-2 text-xs text-slate-400">
                          Communities, societies, interests and hobbies you'd like to meet people through. Tags are only shown and searchable if
                          you turn on "Show and search by my community tags" under Privacy.
                        </p>
                        <TagPicker tags={form.tags} onChange={(tags) => set('tags', tags)} error={errors.tags} />
                      </Section>
                    </>
                  )}

                  {category === 'privacy' && (
                    <Section title="Privacy">
                      <Toggle
                        checked={form.isDiscoverable}
                        onChange={(v) => set('isDiscoverable', v)}
                        label="Let Echo suggest me in player search"
                        hint="When off, you never appear in anyone's search results."
                      />
                      <Toggle
                        checked={form.shareLocation}
                        onChange={(v) => set('shareLocation', v)}
                        label="Show and search by my city"
                        hint="Others can find you by city and see it on your card."
                        disabled={!form.isDiscoverable}
                      />
                      <Toggle
                        checked={form.shareEducation}
                        onChange={(v) => set('shareEducation', v)}
                        label="Show and search by my university and subject"
                        hint="Others can find you by university or course."
                        disabled={!form.isDiscoverable}
                      />
                      <Toggle
                        checked={form.shareInterests}
                        onChange={(v) => set('shareInterests', v)}
                        label="Show and search by my community tags"
                        hint="Some tags say personal things about you (for example communities you belong to). Only share what you're comfortable with."
                        disabled={!form.isDiscoverable}
                      />
                    </Section>
                  )}
                </div>

                <aside className="flex flex-col gap-2 lg:sticky lg:top-0 lg:self-start" aria-labelledby="s-preview">
                  <h3 id="s-preview" className="font-semibold uppercase tracking-wide text-slate-400">
                    What others see
                  </h3>
                  {preview ? (
                    <>
                      <ul>
                        <PlayerCard player={{ ...preview, displayName: preview.displayName || 'Your name', username: preview.username || 'username' }} />
                      </ul>
                      <p className="text-xs text-slate-400">
                        This is your card in Echo's search results.
                        {form.tags.length > 0 && !form.shareInterests && ' Your tags are hidden.'}
                      </p>
                    </>
                  ) : (
                    <p className="rounded-lg bg-white/5 p-3 text-xs text-slate-300">🔒 You're hidden. Echo won't suggest you to other players.</p>
                  )}
                </aside>
              </div>
            </div>

            <footer className="flex items-center justify-end gap-3 border-t border-white/10 px-5 py-3">
              {notice && (
                <p role="status" className={`mr-auto text-sm ${notice.kind === 'ok' ? 'text-emerald-300' : 'text-red-300'}`}>
                  {notice.text}
                </p>
              )}
              <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-slate-300 hover:bg-white/10">
                Close
              </button>
              <button type="submit" disabled={saving || (!dirty && profile !== null)} className="rounded-lg bg-indigo-600 px-4 py-2 font-medium disabled:opacity-40">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </footer>
          </form>
        )}
      </div>
    </div>
  );
}
