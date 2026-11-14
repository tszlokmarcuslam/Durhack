-- Read-only: lists the rules (triggers) that run when a profile is saved, and the tag columns.
-- Changes nothing. Run in the Supabase SQL editor and copy the results.

select 'trigger' as kind, t.tgname as name, p.proname as function_name,
       left(regexp_replace(pg_get_functiondef(p.oid), '\s+', ' ', 'g'), 400) as detail
from pg_trigger t
join pg_proc p on p.oid = t.tgfoid
where t.tgrelid = 'public.profiles'::regclass and not t.tgisinternal
union all
select 'column', column_name, data_type, coalesce(is_generated || ' ' || generation_expression, column_default)
from information_schema.columns
where table_schema = 'public' and table_name = 'profiles' and column_name like 'interest%'
order by 1, 2;
