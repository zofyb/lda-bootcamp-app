-- Update 19: Manager-Punkte
-- Gespräche: Manager tragen nach einem Gespräch 2-3 Stichpunkte ein, der Creator bestätigt in der App, erst dann zählt es.
--            Creator, die noch nicht in der App sind (h:<tiktok-name>), zählen ohne Bestätigung (Status "liste").
-- Wochenaufgabe: Manager stellen ihren Creatorn einmal pro Woche eine entspannte Aufgabe, Creator haken sie ab.
-- Punkte und Stufen der Manager rechnet die App aus diesen Daten aus; sichtbar nur für den Manager selbst und die Leitung.
-- Kann gefahrlos mehrfach ausgeführt werden. Setzt Update 18 voraus.
-- In Supabase: SQL Editor > New query > alles einfügen > Run

create table if not exists public.talks (
  id            uuid primary key default gen_random_uuid(),
  manager_email text not null references public.members(email) on update cascade on delete cascade,
  creator_key   text not null check (char_length(creator_key) <= 120),
  day           date not null,
  tips          text not null check (char_length(tips) between 3 and 600),
  status        text not null default 'offen' check (status in ('offen','ok','nein','liste')),
  answered_at   timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists talks_creator on public.talks (creator_key);

create table if not exists public.mtasks (
  id            uuid primary key default gen_random_uuid(),
  manager_email text not null references public.members(email) on update cascade on delete cascade,
  week          date not null,                       -- Montag der Woche
  body          text not null check (char_length(body) between 3 and 300),
  created_at    timestamptz not null default now(),
  unique (manager_email, week)
);
create table if not exists public.mtask_done (
  task_id       uuid not null references public.mtasks(id) on delete cascade,
  creator_email text not null references public.members(email) on update cascade on delete cascade,
  at            timestamptz not null default now(),
  primary key (task_id, creator_email)
);

-- Gespräch eintragen: Manager/Leitung, nur für eigene Creator (Leitung für alle), Datum höchstens 30 Tage zurück
create or replace function public.talk_stamp() returns trigger
language plpgsql security definer set search_path = public as $$
declare today date := (now() at time zone 'Europe/Berlin')::date;
begin
  if coalesce(public.my_role(),'') not in ('manager','lead') then raise exception 'kein Zugang'; end if;
  if not (public.is_lead() or public.manages_key(new.creator_key)) then raise exception 'nicht dein Creator'; end if;
  if new.day > today or new.day < today - 30 then raise exception 'Datum nicht möglich'; end if;
  new.manager_email := public.my_email();
  new.status := case when new.creator_key like 'h:%' then 'liste' else 'offen' end;
  new.answered_at := null;
  return new;
end $$;
drop trigger if exists stamp on public.talks;
create trigger stamp before insert on public.talks for each row execute function public.talk_stamp();

-- Wochenaufgabe: immer für die laufende Woche des Managers
create or replace function public.mtask_stamp() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(public.my_role(),'') not in ('manager','lead') then raise exception 'kein Zugang'; end if;
  new.manager_email := public.my_email();
  new.week := date_trunc('week', now() at time zone 'Europe/Berlin')::date;
  return new;
end $$;
drop trigger if exists stamp on public.mtasks;
create trigger stamp before insert on public.mtasks for each row execute function public.mtask_stamp();

-- Erledigt: nur der Creator selbst, nur die Aufgabe seines Managers aus dieser Woche
create or replace function public.mdone_stamp() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.my_role() is distinct from 'creator' then raise exception 'kein Zugang'; end if;
  new.creator_email := public.my_email(); new.at := now();
  if not exists (select 1 from public.mtasks t where t.id = new.task_id and t.manager_email = public.my_manager()
                 and t.week = date_trunc('week', now() at time zone 'Europe/Berlin')::date) then raise exception 'Aufgabe nicht gefunden'; end if;
  return new;
end $$;
drop trigger if exists stamp on public.mtask_done;
create trigger stamp before insert on public.mtask_done for each row execute function public.mdone_stamp();

grant select, insert, delete on public.talks, public.mtask_done to authenticated;
grant select, insert, update, delete on public.mtasks to authenticated;
revoke all on public.talks, public.mtasks, public.mtask_done from anon;
alter table public.talks      enable row level security;
alter table public.mtasks     enable row level security;
alter table public.mtask_done enable row level security;
drop policy if exists tk_read on public.talks; drop policy if exists tk_add on public.talks; drop policy if exists tk_del on public.talks;
drop policy if exists mt_read on public.mtasks; drop policy if exists mt_add on public.mtasks; drop policy if exists mt_upd on public.mtasks; drop policy if exists mt_del on public.mtasks;
drop policy if exists md_read on public.mtask_done; drop policy if exists md_add on public.mtask_done; drop policy if exists md_del on public.mtask_done;

create policy tk_read on public.talks for select to authenticated using (
  public.is_lead() or manager_email = public.my_email() or creator_key = public.my_email() or public.manages_key(creator_key));
create policy tk_add on public.talks for insert to authenticated with check (manager_email = public.my_email());
create policy tk_del on public.talks for delete to authenticated using (
  public.is_lead() or (manager_email = public.my_email() and status in ('offen','liste')));

create policy mt_read on public.mtasks for select to authenticated using (
  public.is_lead() or manager_email = public.my_email() or manager_email = public.my_manager());
create policy mt_add on public.mtasks for insert to authenticated with check (manager_email = public.my_email());
create policy mt_upd on public.mtasks for update to authenticated using (manager_email = public.my_email()) with check (manager_email = public.my_email());
create policy mt_del on public.mtasks for delete to authenticated using (manager_email = public.my_email() or public.is_lead());

create policy md_read on public.mtask_done for select to authenticated using (
  public.is_lead() or creator_email = public.my_email()
  or exists (select 1 from public.mtasks t where t.id = task_id and t.manager_email = public.my_email()));
create policy md_add on public.mtask_done for insert to authenticated with check (creator_email = public.my_email());
create policy md_del on public.mtask_done for delete to authenticated using (creator_email = public.my_email());

-- Creator bestätigt oder verneint ein Gespräch
create or replace function public.answer_talk(tid uuid, ok boolean) returns text
language plpgsql security definer set search_path = public as $$
begin
  update public.talks set status = case when ok then 'ok' else 'nein' end, answered_at = now()
   where id = tid and creator_key = public.my_email() and status = 'offen';
  return case when found then 'ok' else 'missing' end;
end $$;
revoke all on function public.answer_talk(uuid, boolean) from public, anon;
grant execute on function public.answer_talk(uuid, boolean) to authenticated;

-- Registriert sich ein Creator, wandern auch die Gespräche von der Liste zu seinem Konto (zählen weiter als "liste")
create or replace function public.guide_adopt() returns trigger
language plpgsql security definer set search_path = public as $$
declare k text;
begin
  if tg_op = 'DELETE' then
    delete from public.guide_checks where creator_email = old.email;
    delete from public.guide_notes  where creator_email = old.email;
    delete from public.talks        where creator_key   = old.email;
    return old;
  end if;
  if new.role = 'creator' and new.handle is not null then
    k := 'h:' || lower(trim(leading '@' from trim(new.handle)));
    insert into public.guide_checks (creator_email, item, status, by_email, at)
      select new.email, item, status, by_email, at from public.guide_checks where creator_email = k
      on conflict (creator_email, item) do nothing;
    delete from public.guide_checks where creator_email = k;
    insert into public.guide_notes (creator_email, chapter, note, by_email, at)
      select new.email, chapter, note, by_email, at from public.guide_notes where creator_email = k
      on conflict (creator_email, chapter) do nothing;
    delete from public.guide_notes where creator_email = k;
    update public.talks set creator_key = new.email where creator_key = k;
  end if;
  return new;
end $$;
