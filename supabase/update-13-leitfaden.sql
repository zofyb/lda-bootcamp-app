-- Update 13: Betreuungsleitfaden (Manager haken pro Creator ab: besprochen / wusste schon, Notiz je Kapitel)
-- In Supabase: SQL Editor > New query > alles einfügen > Run

create table if not exists public.guide_checks (
  creator_email text not null references public.members(email) on update cascade on delete cascade,
  item          text not null check (char_length(item) <= 40),
  status        text not null check (status in ('done','known')),
  by_email      text,
  at            timestamptz not null default now(),
  primary key (creator_email, item)
);
create table if not exists public.guide_notes (
  creator_email text not null references public.members(email) on update cascade on delete cascade,
  chapter       text not null check (char_length(chapter) <= 40),
  note          text not null check (char_length(note) <= 2000),
  by_email      text,
  at            timestamptz not null default now(),
  primary key (creator_email, chapter)
);
grant select, insert, update, delete on public.guide_checks, public.guide_notes to authenticated;
revoke all on public.guide_checks, public.guide_notes from anon;
alter table public.guide_checks enable row level security;
alter table public.guide_notes  enable row level security;
drop policy if exists gc_all on public.guide_checks;
drop policy if exists gn_all on public.guide_notes;
-- Nur der zuständige Manager und die Leitung (Creator sehen den Leitfaden nicht)
create policy gc_all on public.guide_checks for all to authenticated
  using (public.is_lead() or public.manages(creator_email)) with check (public.is_lead() or public.manages(creator_email));
create policy gn_all on public.guide_notes for all to authenticated
  using (public.is_lead() or public.manages(creator_email)) with check (public.is_lead() or public.manages(creator_email));
