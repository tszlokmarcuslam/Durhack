-- Community tags: keep tags as the player typed them (#JazzPiano) and add a lowercase,
-- letters-and-digits-only key per tag for search ("jazz piano" and "#jazzpiano" both match).
-- Run once in the Supabase SQL editor (after 002). Safe to run more than once.
-- The key rule must match tagKey() in src/types/tags.ts.

alter table public.profiles add column if not exists interest_keys text[] not null default '{}';

create or replace function public.profiles_normalise() returns trigger
language plpgsql as $$
begin
  -- trim, drop leading #, drop empties, and de-duplicate by key while keeping the first spelling
  new.interests := coalesce((
    select array_agg(tag order by ord)
    from (
      select distinct on (key) tag, ord, key
      from (
        select ltrim(trim(i), '#') as tag, ord,
               lower(regexp_replace(i, '[^[:alnum:]]', '', 'g')) as key
        from unnest(new.interests) with ordinality as u(i, ord)
      ) raw
      where key <> ''
      order by key, ord
    ) deduped
  ), '{}');
  new.interest_keys := array(select lower(regexp_replace(i, '[^[:alnum:]]', '', 'g')) from unnest(new.interests) as i);
  new.updated_at := now();
  return new;
end $$;

drop index if exists public.profiles_interests_idx;
create index if not exists profiles_interest_keys_idx on public.profiles using gin (interest_keys);

-- Fill interest_keys for existing rows (fires the trigger above).
update public.profiles set interests = interests;
