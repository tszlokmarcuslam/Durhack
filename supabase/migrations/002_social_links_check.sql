-- Restricts profiles.social_links to known keys holding https links.
-- Run once in the Supabase SQL editor on projects created before this file existed
-- (new projects get it from schema.sql). Safe to run more than once.

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
