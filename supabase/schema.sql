-- EchoWorld schema (companion + discovery slice). Run in the Supabase SQL editor.
-- Friendships, parties and activities are added in later phases.

create table if not exists public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  username        text not null unique check (username ~ '^[a-zA-Z0-9_]{3,24}$'),
  display_name    text not null check (char_length(display_name) between 1 and 40),
  location_city   text check (char_length(location_city) <= 60),
  university      text check (char_length(university) <= 60),
  subject         text check (char_length(subject) <= 60),
  interests       text[] not null default '{}' check (cardinality(interests) <= 12),
  bio             text check (char_length(bio) <= 300),
  social_links    jsonb not null default '{}',
  -- Privacy controls. Everything is private until the player opts in.
  is_discoverable boolean not null default false, -- may appear in companion search at all
  share_location  boolean not null default false, -- city is shown and searchable
  share_education boolean not null default false, -- university/subject shown and searchable
  share_interests boolean not null default false, -- interests shown and searchable
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Interests are stored lowercased so search can match them exactly.
create or replace function public.profiles_normalise() returns trigger
language plpgsql as $$
begin
  new.interests := array(select distinct lower(trim(i)) from unnest(new.interests) as i where trim(i) <> '');
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists profiles_normalise on public.profiles;
create trigger profiles_normalise before insert or update on public.profiles
  for each row execute function public.profiles_normalise();

create index if not exists profiles_discoverable_idx on public.profiles (is_discoverable) where is_discoverable;
create index if not exists profiles_interests_idx on public.profiles using gin (interests);

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
