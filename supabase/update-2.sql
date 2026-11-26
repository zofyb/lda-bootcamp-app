-- Update 2: Startdatum, Fortschritt (Video/Handout gesehen), aktive Tage
-- In Supabase: SQL Editor > New query > alles einfügen > Run

create table if not exists public.settings (
  key   text primary key,
  value text
);

create table if not exists public.progress (
  creator_email text not null references public.members(email) on update cascade on delete cascade,
  area          int  not null references public.areas(n) on delete cascade,
  video_at      timestamptz,
  handout_at    timestamptz,
  primary key (creator_email, area)
);

create table if not exists public.activity (
  creator_email text not null references public.members(email) on update cascade on delete cascade,
  day           date not null,
  primary key (creator_email, day)
);

grant select, insert, update, delete on public.settings, public.progress, public.activity to authenticated;
revoke all on public.settings, public.progress, public.activity from anon;

alter table public.settings enable row level security;
alter table public.progress enable row level security;
alter table public.activity enable row level security;

drop policy if exists settings_read  on public.settings;
drop policy if exists settings_write on public.settings;
create policy settings_read  on public.settings for select to authenticated using (public.my_role() is not null);
create policy settings_write on public.settings for all to authenticated using (public.is_lead()) with check (public.is_lead());

drop policy if exists progress_read  on public.progress;
drop policy if exists progress_own   on public.progress;
drop policy if exists progress_upd   on public.progress;
create policy progress_read on public.progress for select to authenticated using (
  creator_email = public.my_email() or public.is_lead() or public.manages(creator_email));
create policy progress_own on public.progress for insert to authenticated with check (creator_email = public.my_email());
create policy progress_upd on public.progress for update to authenticated using (creator_email = public.my_email()) with check (creator_email = public.my_email());

drop policy if exists activity_read on public.activity;
drop policy if exists activity_own  on public.activity;
create policy activity_read on public.activity for select to authenticated using (
  creator_email = public.my_email() or public.is_lead() or public.manages(creator_email));
create policy activity_own on public.activity for insert to authenticated with check (creator_email = public.my_email());

-- Creator dürfen ihre Nachricht an den Manager noch ändern, solange nicht bewertet (gilt schon über subs_update_own)
