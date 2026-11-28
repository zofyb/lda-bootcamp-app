-- Update 22: Rubrik „Team“ + Sperrliste
-- 1) Sperrliste: Gesperrte E-Mail-Adressen oder TikTok-Namen kommen nicht mehr in die App
--    (kein Login, keine Registrierung, keine Daten). Abgaben, Fortschritt und Creator-Zuordnungen bleiben erhalten.
--    Gesperrt werden sofort: Booster, Devil, Sandriii (verlassen die Agentur als Agenten Ende November).
-- 2) Team: Manager und Agenturleitung mit Bild, Name und @TikTok-Name. Die Agenturleitung pflegt alles in der App.
-- Kann gefahrlos mehrfach ausgeführt werden.
-- In Supabase: SQL Editor > New query > alles einfügen > Run

/* ---------- 1) Sperrliste ---------- */
create table if not exists public.blocked (
  value      text primary key check (value = lower(value) and value <> ''),  -- E-Mail-Adresse oder TikTok-Name ohne @
  name       text,
  created_at timestamptz not null default now(),
  created_by text
);
grant select on public.blocked to authenticated;
revoke all on public.blocked from anon;
alter table public.blocked enable row level security;
drop policy if exists blocked_read on public.blocked;

create or replace function public.is_blocked(e text, h text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.blocked b
    where b.value = lower(trim(coalesce(e,'')))
       or b.value = lower(regexp_replace(trim(coalesce(h,'')), '^@', '')))
$$;

create policy blocked_read on public.blocked for select to authenticated using (public.is_lead());

-- Rolle: Gesperrte bekommen keine Rolle mehr (damit greifen alle Zugriffsregeln der App)
create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select m.role from public.members m
  where m.email = public.my_email()
    and not public.is_blocked(m.email, m.handle)
    and (m.role <> 'creator' or exists (
      select 1 from public.roster r where r.handle = lower(regexp_replace(trim(coalesce(m.handle,'')), '^@', ''))))
$$;

-- Login-Prüfung
create or replace function public.is_member(e text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.members m
    where m.email = lower(trim(e))
      and not public.is_blocked(m.email, m.handle)
      and (m.role <> 'creator' or exists (
        select 1 from public.roster r where r.handle = lower(regexp_replace(trim(coalesce(m.handle,'')), '^@', ''))))
  )
$$;

-- Registrierung prüfen
create or replace function public.register_check(h text, e text) returns text
language plpgsql stable security definer set search_path = public as $$
declare hh text := lower(regexp_replace(trim(coalesce(h,'')), '^@', '')); ee text := lower(trim(coalesce(e,'')));
begin
  if hh = '' or ee = '' then return 'missing'; end if;
  if public.is_blocked(ee, hh) then return 'inactive'; end if;
  if exists (select 1 from public.members where email = ee) then
    return case when public.is_member(ee) then 'login' else 'inactive' end;
  end if;
  if not exists (select 1 from public.roster where handle = hh) then return 'not_on_list'; end if;
  if exists (select 1 from public.members where lower(regexp_replace(trim(coalesce(handle,'')), '^@', '')) = hh) then return 'taken'; end if;
  return 'ok';
end $$;

-- Konto anlegen nach dem Code
create or replace function public.claim_member(nm text, h text) returns text
language plpgsql security definer set search_path = public as $$
declare e text := public.my_email(); hh text := lower(regexp_replace(trim(coalesce(h,'')), '^@', '')); r public.roster%rowtype;
begin
  if e = '' then return 'no_login'; end if;
  if public.is_blocked(e, hh) then return 'blocked'; end if;
  if exists (select 1 from public.members where email = e) then return 'exists'; end if;
  select * into r from public.roster where handle = hh;
  if not found then return 'not_on_list'; end if;
  if exists (select 1 from public.members where lower(regexp_replace(trim(coalesce(handle,'')), '^@', '')) = hh) then return 'taken'; end if;
  insert into public.members (email, role, name, handle, manager_email, bootcamp)
  values (e, 'creator', coalesce(nullif(trim(nm),''), r.name, hh), hh, r.manager_email, r.bootcamp);
  return 'ok';
end $$;

-- Sperren / Entsperren (nur Agenturleitung). Agenturleitung selbst kann nicht gesperrt werden.
create or replace function public.block_person(v text, nm text) returns text
language plpgsql security definer set search_path = public as $$
declare vv text := lower(trim(coalesce(v,'')));
begin
  if not public.is_lead() then raise exception 'Keine Berechtigung'; end if;
  if vv !~ '^[^@]+@' then vv := regexp_replace(vv, '^@', ''); end if;  -- TikTok-Name ohne @
  if vv = '' then return 'leer'; end if;
  if exists (select 1 from public.members where role = 'lead'
             and (email = vv or lower(regexp_replace(trim(coalesce(handle,'')), '^@', '')) = vv)) then return 'leitung'; end if;
  insert into public.blocked(value, name, created_by) values (vv, nullif(trim(nm),''), public.my_email())
  on conflict (value) do update set name = coalesce(excluded.name, blocked.name);
  -- Zur Person gehörende E-Mail bzw. TikTok-Namen gleich mitsperren
  insert into public.blocked(value, name, created_by)
  select x, coalesce(nullif(trim(nm),''), m.name), public.my_email()
  from public.members m, lateral (values (m.email), (lower(regexp_replace(trim(coalesce(m.handle,'')), '^@', '')))) t(x)
  where m.role <> 'lead' and x <> '' and (m.email = vv or lower(regexp_replace(trim(coalesce(m.handle,'')), '^@', '')) = vv)
  on conflict (value) do nothing;
  return 'ok';
end $$;

create or replace function public.unblock_person(v text) returns text
language plpgsql security definer set search_path = public as $$
declare nm text;
begin
  if not public.is_lead() then raise exception 'Keine Berechtigung'; end if;
  select name into nm from public.blocked where value = lower(trim(v));
  -- alle Einträge derselben Person (gleicher Name) zusammen freigeben
  if nm is not null then delete from public.blocked where name = nm; end if;
  delete from public.blocked where value = lower(trim(v));
  return 'ok';
end $$;

revoke all on function public.is_blocked(text,text), public.block_person(text,text), public.unblock_person(text) from public, anon;
grant execute on function public.is_blocked(text,text), public.block_person(text,text), public.unblock_person(text) to authenticated;

-- Booster, Devil, Sandriii sperren (TikTok-Namen + bekannte E-Mail-Adressen)
insert into public.blocked(value, name) values
  ('_team_booster_', 'Booster'), ('devil_live_managerin', 'Devil'), ('sandriii_82', 'Sandriii')
on conflict (value) do nothing;
insert into public.blocked(value, name)
select lower(u.email), case split_part(lower(u.email),'@',1) when 'marc1roeder' then 'Booster' when 'nicole.devil' then 'Devil' else 'Sandriii' end
from auth.users u where split_part(lower(u.email),'@',1) in ('marc1roeder','nicole.devil','s.buehler82')
on conflict (value) do nothing;
insert into public.blocked(value, name)
select m.email, case split_part(m.email,'@',1) when 'marc1roeder' then 'Booster' when 'nicole.devil' then 'Devil' else 'Sandriii' end
from public.members m where split_part(m.email,'@',1) in ('marc1roeder','nicole.devil','s.buehler82')
on conflict (value) do nothing;
insert into public.blocked(value, name)
select m.email, b.name from public.members m join public.blocked b on b.value = lower(regexp_replace(trim(coalesce(m.handle,'')), '^@', ''))
where m.role <> 'lead'
on conflict (value) do nothing;

/* ---------- 2) Team ---------- */
create table if not exists public.team (
  id         uuid primary key default gen_random_uuid(),
  grp        text not null default 'manager' check (grp in ('lead','manager')),
  name       text not null,
  handle     text,
  title      text,
  photo      text,             -- Bild im Speicher „unterlagen“
  sort       int not null default 0,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.team to authenticated;
revoke all on public.team from anon;
alter table public.team enable row level security;
drop policy if exists team_read  on public.team;
drop policy if exists team_write on public.team;
create policy team_read  on public.team for select to authenticated using (public.my_role() is not null);
create policy team_write on public.team for all to authenticated using (public.is_lead()) with check (public.is_lead());

-- Startbelegung (nur wenn noch leer). @Namen und Bilder trägt die Agenturleitung in der App ein.
insert into public.team (grp, name, handle, title, sort)
select * from (values
  ('lead','Zofy','zofyb','Agenturleitung',1),
  ('lead','Schlauchi',null,'Agenturleitung',2),
  ('lead','Nik',null,'Assistenz der Leitung',3),
  ('manager','Parec',null,'Manager',1),
  ('manager','Alan',null,'Manager',2),
  ('manager','Susanna',null,'Managerin',3),
  ('manager','Thomas',null,'Manager',4)
) v(grp,name,handle,title,sort)
where not exists (select 1 from public.team);
