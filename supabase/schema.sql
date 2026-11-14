-- EchoWorld schema (companion + discovery slice). Run in the Supabase SQL editor.
-- Friendships, parties and activities are added in later phases.

create table if not exists public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  username        text not null unique check (username ~ '^[a-zA-Z0-9_]{3,24}$'),
  display_name    text not null check (char_length(display_name) between 1 and 40),
  location_city   text check (char_length(location_city) <= 60),
  university      text check (char_length(university) <= 60),
  subject         text check (char_length(subject) <= 60),
  interests       text[] not null default '{}' check (cardinality(interests) <= 12), -- community tags, as typed
  interest_keys   text[] not null default '{}', -- search keys for interests, maintained by trigger
  bio             text check (char_length(bio) <= 300),
  social_links    jsonb not null default '{}',
  -- Privacy controls. Everything is private until the player opts in.
  is_discoverable boolean not null default false, -- may appear in companion search at all
  share_location  boolean not null default false, -- city is shown and searchable
  share_education boolean not null default false, -- university/subject shown and searchable
  share_interests boolean not null default false, -- community tags shown and searchable
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Community tags keep the player's spelling (#JazzPiano); interest_keys holds lowercase
-- letters-and-digits keys for search. Must match tagKey() in src/types/tags.ts.
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

drop trigger if exists profiles_normalise on public.profiles;
create trigger profiles_normalise before insert or update on public.profiles
  for each row execute function public.profiles_normalise();

-- Social links: only known keys holding https links.

create or replace function public.valid_social_links(links jsonb) returns boolean
language sql immutable as $$
  select jsonb_typeof(links) = 'object'
    and not exists (
      select 1 from jsonb_each(links) as e(key, value)
      where e.key not in ('website', 'github', 'linkedin', 'instagram')
         or jsonb_typeof(e.value) <> 'string'
         or char_length(e.value #>> '{}') > 200
         or (e.value #>> '{}') !~ '^https://'
    )
$$;

alter table public.profiles drop constraint if exists profiles_social_links_check;
alter table public.profiles add constraint profiles_social_links_check check (public.valid_social_links(social_links));

create index if not exists profiles_discoverable_idx on public.profiles (is_discoverable) where is_discoverable;
create index if not exists profiles_interest_keys_idx on public.profiles using gin (interest_keys);

-- Row Level Security: a player can only read and write their own row from the browser.
-- Other players' profiles are reachable only through server endpoints (service role),
-- which enforce is_discoverable and the share_* flags per field.
alter table public.profiles enable row level security;

drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own" on public.profiles
  for select to authenticated using (auth.uid() = id);

drop policy if exists "profiles: insert own" on public.profiles;
create policy "profiles: insert own" on public.profiles
  for insert to authenticated with check (auth.uid() = id);

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- Optional test data: sign up two accounts, then for each (replace the uuid):
-- insert into public.profiles (id, username, display_name, location_city, university, subject, interests,
--   is_discoverable, share_location, share_education, share_interests)
-- values ('<auth user id>', 'ada_l', 'Ada', 'Manchester', 'University of Manchester', 'Mathematics',
--   '{chess,climbing}', true, true, true, true);
