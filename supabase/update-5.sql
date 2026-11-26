-- Update 5: Vorher-Nachher, Belohnungen, Top 5, Fragenbox, Umfrage
-- In Supabase: SQL Editor > New query > alles einfügen > Run

-- Belohnungen (Rahmen, Overlay, Animation …) nutzen die Extras-Tabelle
alter table public.extras add column if not exists kind text not null default 'extra';
alter table public.extras drop constraint if exists extras_kind_check;
alter table public.extras add constraint extras_kind_check check (kind in ('extra','reward'));

-- Vorher-Nachher-Screenshots
create table if not exists public.snapshots (
  creator_email text not null references public.members(email) on update cascade on delete cascade,
  kind          text not null check (kind in ('vorher','nachher')),
  path          text not null,
  created_at    timestamptz not null default now(),
  primary key (creator_email, kind)
);

-- Anonyme Fragenbox: speichert bewusst KEINE E-Mail
create table if not exists public.questions (
  id          uuid primary key default gen_random_uuid(),
  body        text not null check (char_length(body) between 3 and 1000),
  created_at  timestamptz not null default now(),
  answer      text,
  answered_at timestamptz,
  published   boolean not null default false
);

-- Umfrage am Ende
create table if not exists public.survey (
  creator_email text primary key references public.members(email) on update cascade on delete cascade,
  rating        int not null check (rating between 1 and 5),
  helped        int,
  missing       text,
  wish          text,
  created_at    timestamptz not null default now()
);

grant select, insert, update, delete on public.snapshots, public.questions, public.survey to authenticated;
revoke all on public.snapshots, public.questions, public.survey from anon;
alter table public.snapshots enable row level security;
alter table public.questions enable row level security;
alter table public.survey    enable row level security;

drop policy if exists snap_read on public.snapshots;
drop policy if exists snap_ins  on public.snapshots;
drop policy if exists snap_upd  on public.snapshots;
drop policy if exists snap_del  on public.snapshots;
create policy snap_read on public.snapshots for select to authenticated using (
  creator_email = public.my_email() or public.is_lead() or public.manages(creator_email));
create policy snap_ins on public.snapshots for insert to authenticated with check (creator_email = public.my_email());
create policy snap_upd on public.snapshots for update to authenticated using (creator_email = public.my_email()) with check (creator_email = public.my_email());
create policy snap_del on public.snapshots for delete to authenticated using (creator_email = public.my_email() or public.is_lead());

drop policy if exists q_ins   on public.questions;
drop policy if exists q_read  on public.questions;
drop policy if exists q_lead  on public.questions;
drop policy if exists q_del   on public.questions;
create policy q_ins  on public.questions for insert to authenticated with check (
  public.my_role() is not null and answer is null and answered_at is null and published = false);
create policy q_read on public.questions for select to authenticated using (
  public.my_role() in ('lead','manager') or (published and public.my_role() is not null));
create policy q_lead on public.questions for update to authenticated using (public.is_lead()) with check (public.is_lead());
create policy q_del  on public.questions for delete to authenticated using (public.is_lead());

drop policy if exists sv_ins  on public.survey;
drop policy if exists sv_read on public.survey;
create policy sv_ins  on public.survey for insert to authenticated with check (creator_email = public.my_email());
create policy sv_read on public.survey for select to authenticated using (creator_email = public.my_email() or public.is_lead());

-- Top 5 für alle Teilnehmer: nur Namen und Platz, keine Punkte
create or replace function public.top5()
returns table (place int, handle text)
language sql stable security definer set search_path = public as $$
  select (row_number() over (order by t.total desc, t.last_at asc))::int as place,
         coalesce(nullif(m.handle,''), split_part(m.name,' ',1)) as handle
  from (
    select s.creator_email, sum(s.points) as total, max(s.submitted_at) as last_at
    from public.submissions s
    where s.points is not null
    group by s.creator_email
    having sum(s.points) > 0
  ) t
  join public.members m on m.email = t.creator_email and m.role = 'creator'
  where public.my_role() is not null
  order by t.total desc, t.last_at asc
  limit 5
$$;
revoke all on function public.top5() from public, anon;
grant execute on function public.top5() to authenticated;
