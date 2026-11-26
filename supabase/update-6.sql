-- Update 6: LIVEdream Academy – TikTok-Liste, Selbst-Registrierung, Bereiche Bootcamp + Akademie
-- In Supabase: SQL Editor > New query > alles einfügen > Run

-- Die Liste: wer drauf steht, darf rein. Fliegt jemand von der Liste, ist der Zugang weg (Daten bleiben).
create table if not exists public.roster (
  handle        text primary key check (handle = lower(handle) and handle <> ''),
  name          text,
  manager_email text references public.members(email) on update cascade on delete set null,
  bootcamp      boolean not null default false,
  added_at      timestamptz not null default now()
);
alter table public.members add column if not exists bootcamp boolean not null default false;

-- Bisherige Creator übernehmen (alle bisherigen sind Bootcamp-Teilnehmer)
insert into public.roster (handle, name, manager_email, bootcamp)
select lower(regexp_replace(trim(handle), '^@', '')), name, manager_email, true
from public.members where role = 'creator' and coalesce(trim(handle), '') <> ''
on conflict (handle) do nothing;
update public.members set bootcamp = true where role = 'creator';

-- Extras bekommen eine Zielgruppe: bootcamp (wie bisher), all (Akademie für alle), team (nur Manager + Leitung)
alter table public.extras add column if not exists audience text not null default 'bootcamp';
alter table public.extras drop constraint if exists extras_audience_check;
alter table public.extras add constraint extras_audience_check check (audience in ('bootcamp','all','team'));
alter table public.extras add column if not exists category text;

-- Rolle nur, wenn man (als Creator) auf der Liste steht
create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select m.role from public.members m
  where m.email = public.my_email()
    and (m.role <> 'creator' or exists (
      select 1 from public.roster r where r.handle = lower(regexp_replace(trim(coalesce(m.handle,'')), '^@', ''))))
$$;

create or replace function public.in_bootcamp() returns boolean
language sql stable security definer set search_path = public as $$
  select case public.my_role()
    when 'lead' then true when 'manager' then true
    when 'creator' then exists (
      select 1 from public.members m join public.roster r on r.handle = lower(regexp_replace(trim(coalesce(m.handle,'')), '^@', ''))
      where m.email = public.my_email() and r.bootcamp)
    else false end
$$;

-- Login nur für aktive Personen
create or replace function public.is_member(e text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.members m
    where m.email = lower(trim(e))
      and (m.role <> 'creator' or exists (
        select 1 from public.roster r where r.handle = lower(regexp_replace(trim(coalesce(m.handle,'')), '^@', ''))))
  )
$$;

-- Vor der Registrierung prüfen: Steht der TikTok-Name auf der Liste und ist er noch frei?
create or replace function public.register_check(h text, e text) returns text
language plpgsql stable security definer set search_path = public as $$
declare hh text := lower(regexp_replace(trim(coalesce(h,'')), '^@', '')); ee text := lower(trim(coalesce(e,'')));
begin
  if hh = '' or ee = '' then return 'missing'; end if;
  if exists (select 1 from public.members where email = ee) then
    return case when public.is_member(ee) then 'login' else 'inactive' end;
  end if;
  if not exists (select 1 from public.roster where handle = hh) then return 'not_on_list'; end if;
  if exists (select 1 from public.members where lower(regexp_replace(trim(coalesce(handle,'')), '^@', '')) = hh) then return 'taken'; end if;
  return 'ok';
end $$;

-- Nach dem Bestätigen der E-Mail: Konto anlegen
create or replace function public.claim_member(nm text, h text) returns text
language plpgsql security definer set search_path = public as $$
declare e text := public.my_email(); hh text := lower(regexp_replace(trim(coalesce(h,'')), '^@', '')); r public.roster%rowtype;
begin
  if e = '' then return 'no_login'; end if;
  if exists (select 1 from public.members where email = e) then return 'exists'; end if;
  select * into r from public.roster where handle = hh;
  if not found then return 'not_on_list'; end if;
  if exists (select 1 from public.members where lower(regexp_replace(trim(coalesce(handle,'')), '^@', '')) = hh) then return 'taken'; end if;
  insert into public.members (email, role, name, handle, manager_email, bootcamp)
  values (e, 'creator', coalesce(nullif(trim(nm),''), r.name, hh), hh, r.manager_email, r.bootcamp);
  return 'ok';
end $$;

-- Liste einspielen (nur Agenturleitung). rows = [{"handle":"…","name":"…","manager_email":"…","bootcamp":true}]
-- Fehlt manager_email oder bootcamp in einer Zeile, bleibt der bisherige Wert.
create or replace function public.import_roster(rows jsonb, replace_all boolean) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.is_lead() then raise exception 'Keine Berechtigung'; end if;
  create temp table _in on commit drop as
  select distinct on (h) h as handle, nullif(trim(x->>'name'),'') as name,
         nullif(lower(trim(x->>'manager_email')),'') as manager_email,
         (x->>'bootcamp')::boolean as bootcamp
  from jsonb_array_elements(rows) x,
       lateral (select lower(regexp_replace(trim(coalesce(x->>'handle','')), '^@', '')) as h) hx
  where h <> '';
  update _in set manager_email = null where manager_email is not null and not exists (select 1 from public.members where email = _in.manager_email);
  if replace_all then delete from public.roster where handle not in (select handle from _in); end if;
  insert into public.roster (handle, name, manager_email, bootcamp)
  select handle, name, manager_email, coalesce(bootcamp, false) from _in
  on conflict (handle) do update set name = coalesce(excluded.name, roster.name), manager_email = coalesce(excluded.manager_email, roster.manager_email), bootcamp = coalesce((select i.bootcamp from _in i where i.handle = excluded.handle), roster.bootcamp);
  update public.members m set manager_email = r.manager_email, bootcamp = r.bootcamp
  from public.roster r where m.role = 'creator' and r.handle = lower(regexp_replace(trim(coalesce(m.handle,'')), '^@', ''));
  select count(*) into n from _in;
  return n;
end $$;

grant select, insert, update, delete on public.roster to authenticated;
revoke all on public.roster from anon;
alter table public.roster enable row level security;
drop policy if exists roster_read  on public.roster;
drop policy if exists roster_write on public.roster;
create policy roster_read on public.roster for select to authenticated using (
  public.is_lead() or manager_email = public.my_email()
  or handle = (select lower(regexp_replace(trim(coalesce(handle,'')), '^@', '')) from public.members where email = public.my_email()));
create policy roster_write on public.roster for all to authenticated using (public.is_lead()) with check (public.is_lead());

-- Bootcamp-Themen sehen nur Bootcamp-Teilnehmer (und Team); Akademie-Inhalte je nach Zielgruppe
drop policy if exists areas_read on public.areas;
create policy areas_read on public.areas for select to authenticated using (public.in_bootcamp());
drop policy if exists extras_read on public.extras;
create policy extras_read on public.extras for select to authenticated using (
  public.my_role() in ('lead','manager')
  or (public.my_role() = 'creator' and (audience = 'all' or (audience = 'bootcamp' and public.in_bootcamp()))));

revoke all on function public.register_check(text,text), public.claim_member(text,text), public.import_roster(jsonb,boolean), public.in_bootcamp() from public;
grant execute on function public.register_check(text,text) to anon, authenticated;
grant execute on function public.claim_member(text,text), public.import_roster(jsonb,boolean), public.in_bootcamp() to authenticated;
