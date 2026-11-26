-- Update 9: Level-System (XP), Backstage-Liste mit zwei Top-5-Listen, Monatsziel mit Manager, Freischaltungen
-- In Supabase: SQL Editor > New query > alles einfügen > Run

-- ---------- XP aus der App (einloggen, Hook des Tages, Impuls, Kampagne gelesen, Akademie-Inhalt) ----------
create table if not exists public.xp_events (
  creator_email text not null references public.members(email) on update cascade on delete cascade,
  kind          text not null,
  ref           text not null,
  xp            int  not null,
  created_at    timestamptz not null default now(),
  primary key (creator_email, kind, ref)
);
grant select on public.xp_events to authenticated;
revoke all on public.xp_events from anon;
alter table public.xp_events enable row level security;
drop policy if exists xp_read on public.xp_events;
create policy xp_read on public.xp_events for select to authenticated using (
  creator_email = public.my_email() or public.is_lead() or public.manages(creator_email));

-- XP vergeben: die Höhe legt die Datenbank fest, nicht die App. Jede Aktion zählt nur einmal pro ref.
create or replace function public.award_xp(k text, r text)
returns int language plpgsql security definer set search_path = public as $$
declare pts int; me text := public.my_email(); n int;
begin
  if public.my_role() is distinct from 'creator' then return 0; end if;
  if r is null or char_length(r) > 80 then return 0; end if;
  pts := case k
    when 'login'  then 5     -- ref = Tag (JJJJ-MM-TT)
    when 'hook'   then 10    -- ref = Tag
    when 'impuls' then 20    -- ref = Woche
    when 'iq1'    then 10    -- ref = Woche, je richtige Frage
    when 'iq2'    then 10
    when 'iq3'    then 10
    when 'camp'   then 15    -- ref = Kampagnen-ID
    when 'extra'  then 15    -- ref = Akademie-Inhalt-ID
    else 0 end;
  if pts = 0 then return 0; end if;
  if k in ('login','hook') and r <> to_char((now() at time zone 'Europe/Berlin')::date, 'YYYY-MM-DD') then return 0; end if;
  if k = 'camp'  and not exists(select 1 from public.calendar where id::text = r and audience = 'all') then return 0; end if;
  if k = 'extra' and not exists(select 1 from public.extras where id::text = r) then return 0; end if;
  insert into public.xp_events(creator_email, kind, ref, xp) values (me, k, r, pts) on conflict do nothing;
  get diagnostics n = row_count;
  return case when n > 0 then pts else 0 end;
end $$;
revoke all on function public.award_xp(text, text) from public, anon;
grant execute on function public.award_xp(text, text) to authenticated;

-- ---------- Backstage-Liste (Export „Creator*innen verwalten“, letzte 30 Tage) ----------
create table if not exists public.backstage (
  month       text not null check (month ~ '^\d{4}-\d{2}$'),
  handle      text not null,
  days        int  not null default 0,
  hours       numeric not null default 0,
  diamonds    bigint not null default 0,
  rank_d      int,
  rank_t      int,
  uploaded_at timestamptz not null default now(),
  primary key (month, handle)
);
grant select, insert, update, delete on public.backstage to authenticated;
revoke all on public.backstage from anon;
alter table public.backstage enable row level security;
drop policy if exists bs_read  on public.backstage;
drop policy if exists bs_write on public.backstage;
-- Creator sehen nur ihre eigene Zeile, Manager die ihrer Creator, Leitung alles
create policy bs_read on public.backstage for select to authenticated using (
  public.is_lead()
  or exists(select 1 from public.members m where lower(m.handle) = lower(backstage.handle)
            and (m.email = public.my_email() or m.manager_email = public.my_email())));
create policy bs_write on public.backstage for all to authenticated using (public.is_lead()) with check (public.is_lead());

-- Zwei Top-5-Listen (Diamanten und Fleißigste nach Live-Tagen): nur Platz und Name, keine Zahlen
drop function if exists public.backstage_top(text);
create or replace function public.backstage_top(m text default null)
returns table (month text, list text, place int, handle text)
language sql stable security definer set search_path = public as $$
  with mm as (select coalesce(m, (select max(b.month) from public.backstage b)) as v)
  select b.month, 'd', b.rank_d, b.handle from public.backstage b, mm where b.month = mm.v and b.rank_d between 1 and 5 and public.my_role() is not null
  union all
  select b.month, 't', b.rank_t, b.handle from public.backstage b, mm where b.month = mm.v and b.rank_t between 1 and 5 and public.my_role() is not null
  order by 2, 3
$$;
revoke all on function public.backstage_top(text) from public, anon;
grant execute on function public.backstage_top(text) to authenticated;

-- ---------- Monatsziel (freiwillig, vom Manager vereinbart) ----------
create table if not exists public.goals (
  creator_email text not null references public.members(email) on update cascade on delete cascade,
  month         text not null check (month ~ '^\d{4}-\d{2}$'),
  title         text not null check (char_length(title) between 1 and 120),
  target        numeric,
  unit          text,
  current       numeric not null default 0,
  done          boolean not null default false,
  set_by        text,
  updated_at    timestamptz not null default now(),
  primary key (creator_email, month)
);
grant select, insert, update, delete on public.goals to authenticated;
revoke all on public.goals from anon;
alter table public.goals enable row level security;
drop policy if exists goal_read  on public.goals;
drop policy if exists goal_write on public.goals;
create policy goal_read on public.goals for select to authenticated using (
  creator_email = public.my_email() or public.is_lead() or public.manages(creator_email));
create policy goal_write on public.goals for all to authenticated using (
  public.is_lead() or public.manages(creator_email)) with check (public.is_lead() or public.manages(creator_email));

-- Creator aktualisiert nur seinen Stand (nicht Ziel, nicht „erreicht“)
create or replace function public.goal_progress(m text, val numeric)
returns void language sql security definer set search_path = public as $$
  update public.goals set current = greatest(0, val), updated_at = now()
  where creator_email = public.my_email() and month = m and not done
$$;
revoke all on function public.goal_progress(text, numeric) from public, anon;
grant execute on function public.goal_progress(text, numeric) to authenticated;

-- ---------- Freischaltungen: Akademie-Inhalte ab einer Stufe ----------
alter table public.extras add column if not exists level int;
