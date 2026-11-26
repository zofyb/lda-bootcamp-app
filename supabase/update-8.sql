-- Update 8: Quiz-Ergebnisse (Streamer-Typ, Nische) im Profil speichern
-- In Supabase: SQL Editor > New query > alles einfügen > Run

create table if not exists public.quiz_results (
  creator_email text not null references public.members(email) on update cascade on delete cascade,
  quiz          text not null check (quiz ~ '^[a-z0-9_-]{1,40}$'),
  result        text not null check (char_length(result) between 1 and 40),
  scores        jsonb,
  created_at    timestamptz not null default now(),
  primary key (creator_email, quiz)
);

grant select, insert, update, delete on public.quiz_results to authenticated;
revoke all on public.quiz_results from anon;
alter table public.quiz_results enable row level security;

drop policy if exists qr_read on public.quiz_results;
drop policy if exists qr_ins  on public.quiz_results;
drop policy if exists qr_upd  on public.quiz_results;
drop policy if exists qr_del  on public.quiz_results;
-- Eigene Ergebnisse; Leitung sieht alle; Manager sehen die ihrer Creator
create policy qr_read on public.quiz_results for select to authenticated using (
  creator_email = public.my_email() or public.is_lead() or public.manages(creator_email));
create policy qr_ins on public.quiz_results for insert to authenticated with check (
  creator_email = public.my_email() and public.my_role() is not null);
create policy qr_upd on public.quiz_results for update to authenticated using (creator_email = public.my_email()) with check (creator_email = public.my_email());
create policy qr_del on public.quiz_results for delete to authenticated using (creator_email = public.my_email() or public.is_lead());
