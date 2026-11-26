-- Update 7: Kummerkasten-Arten, Kalender (Kampagnen + Führung), To-dos der Geschäftsführung
-- In Supabase: SQL Editor > New query > alles einfügen > Run

-- Kummerkasten: Frage, Kritik oder Wunsch (weiterhin ohne Namen)
alter table public.questions add column if not exists kind text not null default 'frage';
alter table public.questions drop constraint if exists questions_kind_check;
alter table public.questions add constraint questions_kind_check check (kind in ('frage','kritik','wunsch'));

-- Kalender: Kampagnen für alle Creator (audience all) und Termine nur für die Führung (audience lead)
create table if not exists public.calendar (
  id          uuid primary key default gen_random_uuid(),
  audience    text not null default 'all' check (audience in ('all','lead')),
  kind        text not null default 'tiktok' check (kind in ('tiktok','livedream','termin')),
  title       text not null check (char_length(title) between 1 and 200),
  starts      date not null,
  ends        date not null,
  at_time     text,
  body        text,
  link        text,
  image       text,
  created_by  text,
  created_at  timestamptz not null default now(),
  check (ends >= starts)
);

-- To-do-Listen der Geschäftsführung
create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  area        text not null default 'Allgemein',
  title       text not null check (char_length(title) between 1 and 300),
  note        text,
  owner_email text references public.members(email) on update cascade on delete set null,
  due         date,
  priority    int not null default 2 check (priority between 1 and 3),
  done_at     timestamptz,
  created_by  text,
  created_at  timestamptz not null default now()
);

grant select, insert, update, delete on public.calendar, public.tasks to authenticated;
revoke all on public.calendar, public.tasks from anon;
alter table public.calendar enable row level security;
alter table public.tasks    enable row level security;

drop policy if exists cal_read  on public.calendar;
drop policy if exists cal_write on public.calendar;
create policy cal_read  on public.calendar for select to authenticated using (
  public.is_lead() or (audience = 'all' and public.my_role() is not null));
create policy cal_write on public.calendar for all to authenticated using (public.is_lead()) with check (public.is_lead());

drop policy if exists tasks_all on public.tasks;
create policy tasks_all on public.tasks for all to authenticated using (public.is_lead()) with check (public.is_lead());
