-- Update 14: 1:1-Termine
-- Leitung und Manager legen feste Wochenzeiten fest (z. B. montags 11 bis 13 Uhr, 30-Minuten-Slots).
-- Daraus entstehen die Slots im Kalender. Creator buchen bei ihrem eigenen Manager (das kann auch jemand aus der Leitung sein).
-- In Supabase: SQL Editor > New query > alles einfügen > Run

drop table if exists public.slots cascade;  -- Vorentwurf, war nie live

-- Feste Wochenzeiten
create table if not exists public.avail (
  id          uuid primary key default gen_random_uuid(),
  owner_email text not null references public.members(email) on update cascade on delete cascade,
  weekday     int  not null check (weekday between 1 and 7),   -- 1 = Montag … 7 = Sonntag
  t_from      time not null,
  t_to        time not null check (t_to > t_from),
  minutes     int  not null default 30 check (minutes between 10 and 180),
  how         text not null default 'WhatsApp-Anruf' check (char_length(how) <= 60),
  created_at  timestamptz not null default now()
);
-- Gesperrte Tage (Urlaub, krank …)
create table if not exists public.avail_off (
  owner_email text not null references public.members(email) on update cascade on delete cascade,
  day         date not null,
  primary key (owner_email, day)
);
-- Buchungen
create table if not exists public.bookings (
  id            uuid primary key default gen_random_uuid(),
  owner_email   text not null references public.members(email) on update cascade on delete cascade,
  creator_email text not null references public.members(email) on update cascade on delete cascade,
  starts_at     timestamptz not null,
  minutes       int  not null,
  how           text not null,
  topic         text check (char_length(topic) <= 500),
  created_at    timestamptz not null default now(),
  unique (owner_email, starts_at)
);

grant select, insert, update, delete on public.avail, public.avail_off, public.bookings to authenticated;
revoke all on public.avail, public.avail_off, public.bookings from anon;
alter table public.avail     enable row level security;
alter table public.avail_off enable row level security;
alter table public.bookings  enable row level security;
drop policy if exists av_staff on public.avail;     drop policy if exists av_creator on public.avail;
drop policy if exists ao_staff on public.avail_off; drop policy if exists ao_creator on public.avail_off;
drop policy if exists bk_staff on public.bookings;  drop policy if exists bk_creator on public.bookings;

-- Leitung sieht und ändert alles; Manager nur das Eigene
create policy av_staff on public.avail for all to authenticated
  using (public.is_lead() or (owner_email = public.my_email() and public.my_role() = 'manager'))
  with check (public.is_lead() or (owner_email = public.my_email() and public.my_role() = 'manager'));
create policy ao_staff on public.avail_off for all to authenticated
  using (public.is_lead() or (owner_email = public.my_email() and public.my_role() = 'manager'))
  with check (public.is_lead() or (owner_email = public.my_email() and public.my_role() = 'manager'));
create policy bk_staff on public.bookings for all to authenticated
  using (public.is_lead() or (owner_email = public.my_email() and public.my_role() = 'manager'))
  with check (public.is_lead() or (owner_email = public.my_email() and public.my_role() = 'manager'));

-- Creator: Zeiten und gesperrte Tage des eigenen Managers lesen, eigene Buchungen lesen
create policy av_creator on public.avail for select to authenticated
  using (public.my_role() = 'creator' and owner_email = public.my_manager());
create policy ao_creator on public.avail_off for select to authenticated
  using (public.my_role() = 'creator' and owner_email = public.my_manager());
create policy bk_creator on public.bookings for select to authenticated
  using (public.my_role() = 'creator' and creator_email = public.my_email());

-- Belegte Zeiten beim eigenen Manager (ohne Namen), damit Creator sehen, was schon weg ist
create or replace function public.busy_times() returns setof timestamptz
language sql stable security definer set search_path = public as $$
  select starts_at from public.bookings
  where owner_email = public.my_manager() and starts_at > now() - interval '1 day'
$$;

-- Buchen: Zeit muss in einer festen Wochenzeit des eigenen Managers liegen, frei sein,
-- mindestens 1 Stunde und höchstens 8 Wochen im Voraus; höchstens 1 offener Termin
create or replace function public.book_slot(st timestamptz, t text) returns text
language plpgsql security definer set search_path = public as $$
declare me text := public.my_email(); mg text := public.my_manager();
        loc timestamp := st at time zone 'Europe/Berlin'; a public.avail;
begin
  if coalesce(public.my_role(),'') <> 'creator' then return 'role'; end if;
  if mg is null then return 'missing'; end if;
  if st < now() + interval '1 hour' then return 'late'; end if;
  if st > now() + interval '8 weeks' then return 'missing'; end if;
  if exists (select 1 from public.bookings where creator_email = me and starts_at > now()) then return 'has'; end if;
  if exists (select 1 from public.avail_off where owner_email = mg and day = loc::date) then return 'missing'; end if;
  select * into a from public.avail
   where owner_email = mg and weekday = extract(isodow from loc)::int
     and loc::time >= t_from and loc::time + make_interval(mins => minutes) <= t_to
     and (extract(epoch from (loc::time - t_from))::int / 60) % minutes = 0
   order by t_from limit 1;
  if not found then return 'missing'; end if;
  begin
    insert into public.bookings(owner_email, creator_email, starts_at, minutes, how, topic)
    values (mg, me, st, a.minutes, a.how, left(nullif(trim(coalesce(t,'')),''), 500));
  exception when unique_violation then return 'taken';
  end;
  return 'ok';
end $$;

-- Absagen durch den Creator (bis zum Beginn)
create or replace function public.cancel_booking(bid uuid) returns text
language plpgsql security definer set search_path = public as $$
begin
  delete from public.bookings where id = bid and creator_email = public.my_email() and starts_at > now();
  return case when found then 'ok' else 'missing' end;
end $$;

revoke all on function public.busy_times() from public, anon;
revoke all on function public.book_slot(timestamptz, text) from public, anon;
revoke all on function public.cancel_booking(uuid) from public, anon;
grant execute on function public.busy_times() to authenticated;
grant execute on function public.book_slot(timestamptz, text) to authenticated;
grant execute on function public.cancel_booking(uuid) to authenticated;
