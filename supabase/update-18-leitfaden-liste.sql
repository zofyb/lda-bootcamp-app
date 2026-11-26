-- Update 18: Betreuungsleitfaden auch für Creator, die auf der Liste stehen, aber (noch) nicht in der App sind
-- Solche Einträge werden unter "h:<tiktok-name>" gespeichert. Registriert sich der Creator später,
-- wandern Haken und Notizen automatisch zu seinem Konto.
-- Kann gefahrlos mehrfach ausgeführt werden.
-- In Supabase: SQL Editor > New query > alles einfügen > Run

alter table public.guide_checks drop constraint if exists guide_checks_creator_email_fkey;
alter table public.guide_notes  drop constraint if exists guide_notes_creator_email_fkey;

-- Darf ich den Leitfaden zu diesem Creator sehen/ändern? (E-Mail = registriert, h:name = nur auf der Liste)
create or replace function public.manages_key(k text) returns boolean
language sql stable security definer set search_path = public as $$
  select case when k like 'h:%'
    then exists (select 1 from public.roster where handle = substr(k, 3) and manager_email = public.my_email())
    else public.manages(k) end
$$;
revoke all on function public.manages_key(text) from public, anon;
grant execute on function public.manages_key(text) to authenticated;

drop policy if exists gc_all on public.guide_checks;
drop policy if exists gn_all on public.guide_notes;
create policy gc_all on public.guide_checks for all to authenticated
  using (public.is_lead() or public.manages_key(creator_email)) with check (public.is_lead() or public.manages_key(creator_email));
create policy gn_all on public.guide_notes for all to authenticated
  using (public.is_lead() or public.manages_key(creator_email)) with check (public.is_lead() or public.manages_key(creator_email));

-- Registriert sich ein Creator (oder bekommt einen TikTok-Namen), übernimmt er die Einträge von der Liste
create or replace function public.guide_adopt() returns trigger
language plpgsql security definer set search_path = public as $$
declare k text;
begin
  if tg_op = 'DELETE' then
    delete from public.guide_checks where creator_email = old.email;
    delete from public.guide_notes  where creator_email = old.email;
    return old;
  end if;
  if new.role = 'creator' and new.handle is not null then
    k := 'h:' || lower(trim(leading '@' from trim(new.handle)));
    insert into public.guide_checks (creator_email, item, status, by_email, at)
      select new.email, item, status, by_email, at from public.guide_checks where creator_email = k
      on conflict (creator_email, item) do nothing;
    delete from public.guide_checks where creator_email = k;
    insert into public.guide_notes (creator_email, chapter, note, by_email, at)
      select new.email, chapter, note, by_email, at from public.guide_notes where creator_email = k
      on conflict (creator_email, chapter) do nothing;
    delete from public.guide_notes where creator_email = k;
  end if;
  return new;
end $$;
drop trigger if exists guide_adopt on public.members;
create trigger guide_adopt after insert or update of handle, role or delete on public.members
  for each row execute function public.guide_adopt();
