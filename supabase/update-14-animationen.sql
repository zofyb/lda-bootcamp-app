-- Update 14: Animationen anfragen (Creator schreiben eine Anfrage, nur die Animations-Verantwortliche sieht und beantwortet alle)
-- In Supabase: SQL Editor > New query > alles einfügen > Run
-- Danach einmal die eigene E-Mail als Verantwortliche eintragen (separate Zeile, steht NICHT im Repo):
--   insert into public.anim_admin(email) values ('deine@mail.de') on conflict do nothing;

create table if not exists public.anim_admin (
  email text primary key
);
revoke all on public.anim_admin from public, anon, authenticated;

create or replace function public.is_anim_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.anim_admin where lower(email) = lower(public.my_email()));
$$;
revoke all on function public.is_anim_owner() from public, anon;
grant execute on function public.is_anim_owner() to authenticated;

create table if not exists public.anim_orders (
  id            uuid primary key default gen_random_uuid(),
  creator_email text not null default public.my_email() references public.members(email) on update cascade on delete cascade,
  item          text not null check (char_length(item) <= 60),
  wish          text not null check (char_length(wish) between 1 and 2000),
  sound         boolean not null default false,
  status        text not null default 'neu' check (status in ('neu','angebot','bezahlt','arbeit','fertig','abgesagt')),
  reply         text check (reply is null or char_length(reply) <= 2000),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
grant select, insert, update, delete on public.anim_orders to authenticated;
revoke all on public.anim_orders from anon;
alter table public.anim_orders enable row level security;
drop policy if exists ao_read on public.anim_orders;
drop policy if exists ao_ins  on public.anim_orders;
drop policy if exists ao_upd  on public.anim_orders;
drop policy if exists ao_del  on public.anim_orders;
-- Creator sehen nur ihre eigenen Anfragen, die Verantwortliche sieht alle (Leitung und Manager sonst nicht)
create policy ao_read on public.anim_orders for select to authenticated using (
  creator_email = public.my_email() or public.is_anim_owner());
create policy ao_ins on public.anim_orders for insert to authenticated with check (
  creator_email = public.my_email() and public.my_role() is not null and status = 'neu' and reply is null);
create policy ao_upd on public.anim_orders for update to authenticated using (public.is_anim_owner()) with check (public.is_anim_owner());
create policy ao_del on public.anim_orders for delete to authenticated using (
  public.is_anim_owner() or (creator_email = public.my_email() and status = 'neu'));
