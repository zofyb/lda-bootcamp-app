-- Update 17: YouTube-Links für Akademie-Inhalte + Nachtrag Match-Börse (Wiederholung an Wochentagen, 1 Woche)
-- Kann gefahrlos auch mehrfach ausgeführt werden.
-- In Supabase: SQL Editor > New query > alles einfügen > Run

-- 1) Akademie-Inhalte dürfen neben TikTok- auch YouTube-Links haben (Schulungsaufzeichnungen, nicht gelistet)
alter table public.extras drop constraint if exists extras_link_tiktok;
alter table public.extras add constraint extras_link_tiktok check (
  link is null
  or link ~ '^https://(www\.|vm\.|vt\.)?tiktok\.com/'
  or link ~ '^https://(www\.|m\.)?(youtube\.com|youtu\.be)/'
);

-- 2) Match-Börse: Wochentage und Ablaufzeit (falls Update 16 in einer früheren Fassung lief)
alter table public.match_posts add column if not exists days int[];
alter table public.match_posts drop constraint if exists match_posts_days_check;
alter table public.match_posts add constraint match_posts_days_check check (days <@ array[1,2,3,4,5,6,7]);
alter table public.match_posts add column if not exists until timestamptz;
update public.match_posts set until = live_at + case when days is null then interval '3 hours' else interval '7 days' end where until is null;

create or replace function public.stamp_author() returns trigger
language plpgsql security definer set search_path = public as $$
declare me text := public.my_email(); h text; n text; k text := TG_ARGV[0];
begin
  if public.my_role() is null then raise exception 'kein Zugang'; end if;
  select handle, name into h, n from public.members where email = me;
  new := jsonb_populate_record(new, jsonb_build_object(k, me, 'handle', h, 'name', n));
  if TG_TABLE_NAME = 'match_posts' then
    if new.live_at < now() - interval '1 hour' or new.live_at > now() + interval '14 days' then raise exception 'Zeitpunkt nicht möglich'; end if;
    if new.days = '{}' then new.days := null; end if;
    new.until := new.live_at + case when new.days is null then interval '3 hours' else interval '7 days' end;
    if (select count(*) from public.match_posts where author_email = me and until > now()) >= 3 then raise exception 'Höchstens 3 offene Inserate'; end if;
  elsif TG_TABLE_NAME = 'wins' then
    if new.path is not null and new.path not like me || '/%' then raise exception 'ungültiger Pfad'; end if;
    if (select count(*) from public.wins where author_email = me and created_at > now() - interval '1 day') >= 5 then raise exception 'Höchstens 5 Erfolge pro Tag'; end if;
  end if;
  return new;
end $$;
