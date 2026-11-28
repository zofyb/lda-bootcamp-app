-- Update 23: Manager und Agenturleitung füllen ihr Team-Profil selbst aus (Name, @TikTok, Aufgabe, Profilbild)
-- Jede Team-Karte kann mit einem Konto verknüpft werden. Profilbild = eigenes Profilbild aus der App.
-- Kann gefahrlos mehrfach ausgeführt werden.
-- In Supabase: SQL Editor > New query > alles einfügen > Run

alter table public.team add column if not exists email text;
create unique index if not exists team_email_key on public.team(email) where email is not null;

-- Bestehende Karten über den Namen mit den Konten von Leitung/Managern verknüpfen
update public.team t set email = m.email
from public.members m
where t.email is null and m.role in ('lead','manager')
  and lower(trim(m.name)) = lower(trim(t.name))
  and not exists (select 1 from public.team t2 where t2.email = m.email);

-- Eigenes Team-Profil speichern (nur Manager und Agenturleitung). Legt die Karte an, falls es noch keine gibt.
create or replace function public.my_team_save(nm text, h text, t text) returns text
language plpgsql security definer set search_path = public as $$
declare me text := public.my_email(); r text := public.my_role();
        hh text := nullif(regexp_replace(regexp_replace(lower(trim(coalesce(h,''))), '^(https?://)?(www\.)?tiktok\.com/@?', ''), '^@|[/?#].*$', '', 'g'), '');
begin
  if r is null or r not in ('lead','manager') then return 'nein'; end if;
  if coalesce(trim(nm),'') = '' then return 'name'; end if;
  update public.team set name = trim(nm), handle = hh, title = nullif(trim(coalesce(t,'')),'') where email = me;
  if not found then
    insert into public.team(email, grp, name, handle, title, sort)
    values (me, case r when 'lead' then 'lead' else 'manager' end, trim(nm), hh, nullif(trim(coalesce(t,'')),''),
            coalesce((select max(sort) from public.team where grp = case r when 'lead' then 'lead' else 'manager' end), 0) + 1);
  end if;
  return 'ok';
end $$;
revoke all on function public.my_team_save(text,text,text) from public, anon;
grant execute on function public.my_team_save(text,text,text) to authenticated;
