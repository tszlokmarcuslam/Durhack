-- Friends and parties. Run once in a NEW SQL Editor query, whole file, nothing selected.
-- The last result should say: ok - friends and parties ready. Safe to run more than once.
--
-- The tables have Row Level Security on and no policies, so the browser cannot read or write them
-- directly. Everything goes through the functions below, which check who is calling (auth.uid())
-- and only ever return usernames and display names, never private profile fields.

create table if not exists public.friendships (
  id         uuid primary key default gen_random_uuid(),
  requester  uuid not null references public.profiles (id) on delete cascade,
  addressee  uuid not null references public.profiles (id) on delete cascade,
  status     text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  check (requester <> addressee)
);
-- one row per pair, whichever way round the request went
create unique index if not exists friendships_pair_idx
  on public.friendships (least(requester, addressee), greatest(requester, addressee));

create table if not exists public.parties (
  id         uuid primary key default gen_random_uuid(),
  leader     uuid not null references public.profiles (id) on delete cascade,
  activity   text not null default 'hangout' check (activity in ('study', 'hangout', 'music', 'exercise')),
  created_at timestamptz not null default now()
);

create table if not exists public.party_members (
  party_id  uuid not null references public.parties (id) on delete cascade,
  user_id   uuid not null unique references public.profiles (id) on delete cascade, -- one party at a time
  joined_at timestamptz not null default now(),
  primary key (party_id, user_id)
);

create table if not exists public.party_invites (
  id         uuid primary key default gen_random_uuid(),
  party_id   uuid not null references public.parties (id) on delete cascade,
  inviter    uuid not null references public.profiles (id) on delete cascade,
  invitee    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (party_id, invitee)
);

alter table public.friendships enable row level security;
alter table public.parties enable row level security;
alter table public.party_members enable row level security;
alter table public.party_invites enable row level security;

-- ---------- helpers ----------

-- Parameter names are part of the API; drop first so a re-run can't fail on a rename.
drop function if exists public.create_party(text);
drop function if exists public.set_party_activity(text);

create or replace function public.require_player() returns uuid
language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Sign in first.'; end if;
  if not exists (select 1 from profiles where id = me) then
    raise exception 'Set up your profile in Settings first.';
  end if;
  return me;
end $$;

create or replace function public.are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from friendships
    where status = 'accepted' and least(requester, addressee) = least(a, b) and greatest(requester, addressee) = greatest(a, b)
  )
$$;

-- ---------- friends ----------

create or replace function public.send_friend_request(target_username text) returns text
language plpgsql security definer set search_path = public as $$
declare
  me uuid := require_player();
  target uuid;
  existing friendships;
begin
  select id into target from profiles where lower(username) = lower(trim(target_username));
  if target is null then raise exception 'No player is called @%.', trim(target_username); end if;
  if target = me then raise exception 'That''s you!'; end if;

  select * into existing from friendships
  where least(requester, addressee) = least(me, target) and greatest(requester, addressee) = greatest(me, target);
  if found then
    if existing.status = 'accepted' then return 'already_friends'; end if;
    if existing.requester = me then return 'already_requested'; end if;
    update friendships set status = 'accepted' where id = existing.id; -- they already asked you
    return 'accepted';
  end if;

  if (select count(*) from friendships where requester = me and status = 'pending') >= 50 then
    raise exception 'You have too many pending requests. Wait for some replies first.';
  end if;
  insert into friendships (requester, addressee) values (me, target);
  return 'requested';
end $$;

create or replace function public.respond_friend_request(request_id uuid, accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := require_player();
begin
  if accept then
    update friendships set status = 'accepted' where id = request_id and addressee = me and status = 'pending';
  else
    delete from friendships where id = request_id and addressee = me and status = 'pending';
  end if;
  if not found then raise exception 'That request is no longer available.'; end if;
end $$;

-- Unfriend, or cancel a request you sent.
create or replace function public.remove_friend(other uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := require_player();
begin
  delete from friendships
  where least(requester, addressee) = least(me, other) and greatest(requester, addressee) = greatest(me, other);
end $$;

create or replace function public.my_friends()
returns table (friendship_id uuid, user_id uuid, username text, display_name text, status text, incoming boolean)
language sql stable security definer set search_path = public as $$
  select f.id, p.id, p.username, p.display_name, f.status, (f.addressee = auth.uid())
  from friendships f
  join profiles p on p.id = case when f.requester = auth.uid() then f.addressee else f.requester end
  where auth.uid() in (f.requester, f.addressee)
  order by p.display_name
$$;

-- ---------- parties ----------

create or replace function public.leave_party() returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := require_player();
  pid uuid;
begin
  delete from party_members where user_id = me returning party_id into pid;
  if pid is null then return; end if;
  if not exists (select 1 from party_members where party_id = pid) then
    delete from parties where id = pid; -- last one out closes the party
  elsif (select leader from parties where id = pid) = me then
    update parties set leader = (select user_id from party_members where party_id = pid order by joined_at limit 1)
    where id = pid; -- hand leadership to whoever has been there longest
  end if;
end $$;

create or replace function public.create_party(new_activity text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me uuid := require_player();
  pid uuid;
begin
  perform leave_party();
  insert into parties (leader, activity) values (me, new_activity) returning id into pid;
  insert into party_members (party_id, user_id) values (pid, me);
  return pid;
end $$;

create or replace function public.set_party_activity(new_activity text) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := require_player();
begin
  update parties p set activity = new_activity
  where p.leader = me and p.id = (select party_id from party_members where user_id = me);
  if not found then raise exception 'Only the party leader can change the activity.'; end if;
end $$;

create or replace function public.invite_to_party(friend uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := require_player();
  pid uuid;
begin
  select party_id into pid from party_members where user_id = me;
  if pid is null then raise exception 'Create or join a party first.'; end if;
  if not are_friends(me, friend) then raise exception 'You can only invite friends.'; end if;
  if exists (select 1 from party_members where party_id = pid and user_id = friend) then
    raise exception 'They''re already in your party.';
  end if;
  insert into party_invites (party_id, inviter, invitee) values (pid, me, friend) on conflict (party_id, invitee) do nothing;
end $$;

create or replace function public.respond_party_invite(invite_id uuid, accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := require_player();
  inv party_invites;
begin
  select * into inv from party_invites where id = invite_id and invitee = me;
  if not found then raise exception 'That invite is no longer available.'; end if;
  delete from party_invites where id = invite_id;
  if accept then
    perform leave_party();
    if not exists (select 1 from parties where id = inv.party_id) then raise exception 'That party has ended.'; end if;
    insert into party_members (party_id, user_id) values (inv.party_id, me);
  end if;
end $$;

create or replace function public.my_party()
returns table (party_id uuid, activity text, leader uuid, user_id uuid, username text, display_name text)
language sql stable security definer set search_path = public as $$
  select pa.id, pa.activity, pa.leader, p.id, p.username, p.display_name
  from party_members mine
  join parties pa on pa.id = mine.party_id
  join party_members m on m.party_id = pa.id
  join profiles p on p.id = m.user_id
  where mine.user_id = auth.uid()
  order by m.joined_at
$$;

create or replace function public.my_party_invites()
returns table (invite_id uuid, party_id uuid, activity text, inviter_username text, inviter_display_name text, member_count bigint)
language sql stable security definer set search_path = public as $$
  select i.id, pa.id, pa.activity, p.username, p.display_name,
         (select count(*) from party_members m where m.party_id = pa.id)
  from party_invites i
  join parties pa on pa.id = i.party_id
  join profiles p on p.id = i.inviter
  where i.invitee = auth.uid()
  order by i.created_at desc
$$;

-- Only signed-in players may call these.
do $$
declare fn text;
begin
  foreach fn in array array[
    'require_player()', 'are_friends(uuid, uuid)', 'send_friend_request(text)', 'respond_friend_request(uuid, boolean)',
    'remove_friend(uuid)', 'my_friends()', 'leave_party()', 'create_party(text)', 'set_party_activity(text)',
    'invite_to_party(uuid)', 'respond_party_invite(uuid, boolean)', 'my_party()', 'my_party_invites()'
  ] loop
    execute format('revoke all on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end $$;

select 'ok - friends and parties ready' as result;
