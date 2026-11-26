-- Update 14: 1:1-Termine
-- Jede Person aus Leitung und Manager-Team trägt eigene freie Zeiten ein.
-- Creator buchen bei ihrem eigenen Manager (das kann auch jemand aus der Leitung sein).
-- In Supabase: SQL Editor > New query > alles einfügen > Run

create table if not exists public.slots (
  id          uuid primary key default gen_random_uuid(),
  owner_email text not null references public.members(email) on update cascade on delete cascade,
  starts_at   timestamptz not null,
  minutes     int  not null default 30 check (minutes between 10 and 180),
  how         text not null default 'WhatsApp-Anruf' check (char_length(how) <= 60),
  booked_by   text references public.members(email) on update cascade on delete set null,
  topic       text check (char_length(topic) <= 500),
  booked_at   timestamptz,
  created_at  timestamptz not null default now(),
  unique (owner_email, starts_at)
);
create index if not exists slots_owner_idx on public.slots (owner_email, starts_at);

grant select, insert, update, delete on public.slots to authenticated;
revoke all on public.slots from anon;
alter table public.slots enable row level security;
drop policy if exists sl_staff on public.slots;
drop policy if exists sl_creator on public.slots;

-- Leitung sieht alle Zeiten; Manager und Leitung pflegen ihre eigenen
create policy sl_staff on public.slots for all to authenticated
  using (public.is_lead() or (owner_email = public.my_email() and public.my_role() = 'manager'))
  with check (public.is_lead() or (owner_email = public.my_email() and public.my_role() = 'manager'));

-- Creator sehen nur freie Zeiten ihres eigenen Managers und ihre eigenen Buchungen (nur lesen)
create policy sl_creator on public.slots for select to authenticated
  using (public.my_role() = 'creator' and owner_email = public.my_manager()
         and (booked_by is null or booked_by = public.my_email()));

-- Buchen: nur beim eigenen Manager, frei, mindestens 1 Stunde vorher, höchstens 1 offener Termin
create or replace function public.book_slot(sid uuid, t text) returns text
language plpgsql security definer set search_path = public as $$
declare s public.slots; me text := public.my_email();
begin
  if coalesce(public.my_role(),'') <> 'creator' then return 'role'; end if;
  select * into s from public.slots where id = sid for update;
  if not found or s.owner_email is distinct from public.my_manager() then return 'missing'; end if;
  if s.booked_by = me then return 'ok'; end if;
  if s.booked_by is not null then return 'taken'; end if;
  if s.starts_at < now() + interval '1 hour' then return 'late'; end if;
  if exists (select 1 from public.slots where booked_by = me and starts_at > now()) then return 'has'; end if;
  update public.slots set booked_by = me, topic = left(nullif(trim(coalesce(t,'')),''), 500), booked_at = now() where id = sid;
  return 'ok';
end $$;

-- Absagen durch den Creator (bis zum Beginn)
create or replace function public.cancel_slot(sid uuid) returns text
language plpgsql security definer set search_path = public as $$
begin
  update public.slots set booked_by = null, topic = null, booked_at = null
   where id = sid and booked_by = public.my_email() and starts_at > now();
  return case when found then 'ok' else 'missing' end;
end $$;

revoke all on function public.book_slot(uuid, text) from public, anon;
revoke all on function public.cancel_slot(uuid) from public, anon;
grant execute on function public.book_slot(uuid, text) to authenticated;
grant execute on function public.cancel_slot(uuid) to authenticated;
