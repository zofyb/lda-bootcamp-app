-- Update 21: Bewerbung fürs Bootcamp
-- Creator ohne Bootcamp-Zugang bewerben sich in der App. Die Agenturleitung nimmt an oder lehnt ab.
-- Annehmen schaltet das Bootcamp sofort frei (Liste + Profil). Kann gefahrlos mehrfach ausgeführt werden.
-- In Supabase: SQL Editor > New query > alles einfügen > Run

create table if not exists public.boot_apps (
  creator_email text primary key,
  note          text not null default '',
  status        text not null default 'offen' check (status in ('offen','ja','nein')),
  created_at    timestamptz not null default now(),
  decided_at    timestamptz,
  decided_by    text
);
grant select on public.boot_apps to authenticated;
revoke all on public.boot_apps from anon;
alter table public.boot_apps enable row level security;
drop policy if exists boot_apps_read on public.boot_apps;
create policy boot_apps_read on public.boot_apps for select to authenticated using (
  creator_email = public.my_email() or public.is_lead() or public.manages(creator_email));

-- Bewerben (Creator). Nach einer Absage darf man sich erneut bewerben.
create or replace function public.apply_bootcamp(msg text) returns text
language plpgsql security definer set search_path = public as $$
declare me text := public.my_email();
begin
  if public.my_role() is distinct from 'creator' then return 'nein'; end if;
  if char_length(coalesce(trim(msg),'')) < 5 or char_length(msg) > 1500 then return 'text'; end if;
  if exists (select 1 from public.members where email = me and bootcamp) then return 'schon'; end if;
  insert into public.boot_apps(creator_email, note, status, created_at, decided_at, decided_by)
  values (me, trim(msg), 'offen', now(), null, null)
  on conflict (creator_email) do update set note = excluded.note, status = 'offen', created_at = now(), decided_at = null, decided_by = null
    where boot_apps.status <> 'ja';
  return 'ok';
end $$;

-- Entscheiden (nur Agenturleitung). ok = true schaltet das Bootcamp frei.
create or replace function public.decide_bootcamp(c text, ok boolean) returns text
language plpgsql security definer set search_path = public as $$
declare h text;
begin
  if not public.is_lead() then raise exception 'Keine Berechtigung'; end if;
  update public.boot_apps set status = case when ok then 'ja' else 'nein' end, decided_at = now(), decided_by = public.my_email()
    where creator_email = c;
  if ok then
    update public.members set bootcamp = true where email = c returning handle into h;
    if h is not null then update public.roster set bootcamp = true where handle = lower(regexp_replace(trim(h), '^@', '')); end if;
  end if;
  return 'ok';
end $$;
revoke all on function public.apply_bootcamp(text), public.decide_bootcamp(text, boolean) from public, anon;
grant execute on function public.apply_bootcamp(text), public.decide_bootcamp(text, boolean) to authenticated;
