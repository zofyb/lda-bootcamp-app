-- Update 11: Recruiter-Programm (geworbene Streamer, Bestätigung durch die Leitung, Money Gun verschickt)
-- In Supabase: SQL Editor > New query > alles einfügen > Run

create table if not exists public.referrals (
  recruit_handle  text primary key check (recruit_handle ~ '^[a-z0-9._]{1,40}$'),
  recruiter_email text not null references public.members(email) on update cascade on delete cascade,
  status          text not null default 'offen' check (status in ('offen','ok','nein')),
  gun_sent        boolean not null default false,
  source          text not null default 'creator',
  created_at      timestamptz not null default now(),
  decided_at      timestamptz
);
grant select, insert, update, delete on public.referrals to authenticated;
revoke all on public.referrals from anon;
alter table public.referrals enable row level security;
drop policy if exists ref_read  on public.referrals;
drop policy if exists ref_write on public.referrals;
create policy ref_read on public.referrals for select to authenticated using (
  recruiter_email = public.my_email() or public.is_lead() or public.manages(recruiter_email));
create policy ref_write on public.referrals for all to authenticated using (public.is_lead()) with check (public.is_lead());

-- Creator meldet: „Ich habe @… geworben“ (wartet auf Bestätigung der Leitung)
create or replace function public.report_referral(rh text)
returns text language plpgsql security definer set search_path = public as $$
declare h text := lower(regexp_replace(trim(coalesce(rh,'')), '^@', '')); me text := public.my_email();
begin
  if public.my_role() is null then return 'no_access'; end if;
  if h !~ '^[a-z0-9._]{1,40}$' then return 'invalid'; end if;
  if exists(select 1 from public.members where email = me and lower(coalesce(handle,'')) = h) then return 'self'; end if;
  if exists(select 1 from public.referrals where recruit_handle = h) then return 'exists'; end if;
  insert into public.referrals(recruit_handle, recruiter_email, source) values (h, me, 'creator');
  return 'ok';
end $$;

-- Neue*r Creator gibt bei der Registrierung an, wer eingeladen hat
create or replace function public.claim_referral(rh text)
returns text language plpgsql security definer set search_path = public as $$
declare h text := lower(regexp_replace(trim(coalesce(rh,'')), '^@', '')); mine text; rec text;
begin
  select lower(handle) into mine from public.members where email = public.my_email();
  if mine is null then return 'no_member'; end if;
  select email into rec from public.members where lower(regexp_replace(coalesce(handle,''), '^@', '')) = h and email <> public.my_email() limit 1;
  if rec is null then return 'unknown'; end if;
  if exists(select 1 from public.referrals where recruit_handle = mine) then return 'exists'; end if;
  insert into public.referrals(recruit_handle, recruiter_email, source) values (mine, rec, 'registrierung');
  return 'ok';
end $$;
revoke all on function public.report_referral(text), public.claim_referral(text) from public, anon;
grant execute on function public.report_referral(text), public.claim_referral(text) to authenticated;

-- TikTok-Tippvideos in der Akademie: nur Vorschaubild, Klick führt zum Video auf TikTok
alter table public.extras add column if not exists link text;
alter table public.extras drop constraint if exists extras_link_tiktok;
alter table public.extras add constraint extras_link_tiktok check (link is null or link ~ '^https://(www\.|vm\.|vt\.)?tiktok\.com/');
