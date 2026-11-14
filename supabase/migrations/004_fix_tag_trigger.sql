-- Replaces the profile-save rule with the community-tags version, checks it took effect,
-- and refreshes existing rows. Safe to run more than once.
-- Paste the WHOLE file into a NEW query in the SQL editor, with nothing selected, then Run.
-- The last result should say: ok - tag rule updated.

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

do $$
begin
  if pg_get_functiondef('public.profiles_normalise'::regproc) not like '%interest_keys%' then
    raise exception 'profiles_normalise was not updated - make sure the whole file ran';
  end if;
end $$;

update public.profiles set interests = interests;

select 'ok - tag rule updated' as result;
