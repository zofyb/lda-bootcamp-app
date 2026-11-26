-- Update 12 (Lark): Kampagnen aus der eigenen Lark-Gruppe kommen als Entwurf in den Kalender.
-- Die Leitung sieht Entwürfe unter "Neu aus Lark" und gibt sie frei. Creator sehen nur Freigegebenes.
-- In Supabase: SQL Editor > New query > alles einfügen > Run

alter table public.calendar add column if not exists status      text not null default 'live';
alter table public.calendar add column if not exists source      text;
alter table public.calendar add column if not exists lark_msg_id text;
alter table public.calendar drop constraint if exists calendar_status_check;
alter table public.calendar add constraint calendar_status_check check (status in ('draft','live'));
create unique index if not exists calendar_lark_msg_uniq on public.calendar (lark_msg_id);

-- Creator und Manager sehen nur freigegebene Einträge, die Leitung sieht alles
drop policy if exists cal_read on public.calendar;
create policy cal_read on public.calendar for select to authenticated using (
  public.is_lead() or (audience = 'all' and status = 'live' and public.my_role() is not null));
