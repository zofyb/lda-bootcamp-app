-- Update 16: Match-Börse und Erfolge-Wand
-- Match-Börse: Creator inserieren, wann sie live sind und Lust auf Matches haben; andere tippen "Bin dabei".
-- Einmalig: verschwindet 3 Stunden nach Start. Wiederkehrend (Wochentage): läuft 1 Woche oder bis zum Löschen.
-- Erfolge-Wand: Creator teilen einen Erfolg (Screenshot + kurzer Text), andere reagieren mit Emojis.
-- Alle in der App sehen alles; löschen dürfen nur die Verfasser und die Leitung.
-- In Supabase: SQL Editor > New query > alles einfügen > Run

create table if not exists public.match_posts (
  id           uuid primary key default gen_random_uuid(),
  author_email text not null references public.members(email) on update cascade on delete cascade,
  handle       text,
  name         text,
  live_at      timestamptz not null,
  days         int[] check (days <@ array[1,2,3,4,5,6,7]),   -- Wochentage bei Wiederholung (1 = Montag)
  until        timestamptz,                                    -- bis wann das Inserat sichtbar ist (setzt die Datenbank)
  rules        text check (char_length(rules) <= 200),
  note         text check (char_length(note) <= 300),
  created_at   timestamptz not null default now()
);
create table if not exists public.match_likes (
  post_id    uuid not null references public.match_posts(id) on delete cascade,
  email      text not null references public.members(email) on update cascade on delete cascade,
  handle     text,
  created_at timestamptz not null default now(),
  primary key (post_id, email)
);
create table if not exists public.wins (
  id           uuid primary key default gen_random_uuid(),
  author_email text not null references public.members(email) on update cascade on delete cascade,
  handle       text,
  name         text,
  path         text check (char_length(path) <= 200),
  body         text not null check (char_length(body) between 1 and 300),
  created_at   timestamptz not null default now()
);
create table if not exists public.win_reacts (
  win_id uuid not null references public.wins(id) on delete cascade,
  email  text not null references public.members(email) on update cascade on delete cascade,
  emoji  text not null check (emoji in ('🔥','👏','😍','💪','🎉')),
  primary key (win_id, email, emoji)
);

-- Verfasser, TikTok-Name und Name setzt immer die Datenbank (niemand kann für andere posten)
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
drop trigger if exists stamp on public.match_posts; create trigger stamp before insert on public.match_posts for each row execute function public.stamp_author('author_email');
drop trigger if exists stamp on public.match_likes; create trigger stamp before insert on public.match_likes for each row execute function public.stamp_author('email');
drop trigger if exists stamp on public.wins;        create trigger stamp before insert on public.wins        for each row execute function public.stamp_author('author_email');
drop trigger if exists stamp on public.win_reacts;  create trigger stamp before insert on public.win_reacts  for each row execute function public.stamp_author('email');

grant select, insert, delete on public.match_posts, public.match_likes, public.wins, public.win_reacts to authenticated;
revoke all on public.match_posts, public.match_likes, public.wins, public.win_reacts from anon;
alter table public.match_posts enable row level security;
alter table public.match_likes enable row level security;
alter table public.wins        enable row level security;
alter table public.win_reacts  enable row level security;
drop policy if exists mp_read on public.match_posts; drop policy if exists mp_add on public.match_posts; drop policy if exists mp_del on public.match_posts;
drop policy if exists ml_read on public.match_likes; drop policy if exists ml_add on public.match_likes; drop policy if exists ml_del on public.match_likes;
drop policy if exists wi_read on public.wins;        drop policy if exists wi_add on public.wins;        drop policy if exists wi_del on public.wins;
drop policy if exists wr_read on public.win_reacts;  drop policy if exists wr_add on public.win_reacts;  drop policy if exists wr_del on public.win_reacts;

create policy mp_read on public.match_posts for select to authenticated using (public.my_role() is not null);
create policy mp_add  on public.match_posts for insert to authenticated with check (author_email = public.my_email());
create policy mp_del  on public.match_posts for delete to authenticated using (author_email = public.my_email() or public.is_lead());
create policy ml_read on public.match_likes for select to authenticated using (public.my_role() is not null);
create policy ml_add  on public.match_likes for insert to authenticated with check (email = public.my_email());
create policy ml_del  on public.match_likes for delete to authenticated using (email = public.my_email() or public.is_lead());
create policy wi_read on public.wins for select to authenticated using (public.my_role() is not null);
create policy wi_add  on public.wins for insert to authenticated with check (author_email = public.my_email());
create policy wi_del  on public.wins for delete to authenticated using (author_email = public.my_email() or public.is_lead());
create policy wr_read on public.win_reacts for select to authenticated using (public.my_role() is not null);
create policy wr_add  on public.win_reacts for insert to authenticated with check (email = public.my_email());
create policy wr_del  on public.win_reacts for delete to authenticated using (email = public.my_email());

-- Screenshots der Erfolge (die App verkleinert sie, max. 600 KB)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('erfolge', 'erfolge', false, 600000, array['image/jpeg','image/webp'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists er_read   on storage.objects;
drop policy if exists er_insert on storage.objects;
drop policy if exists er_delete on storage.objects;
create policy er_read on storage.objects for select to authenticated using (
  bucket_id = 'erfolge' and public.my_role() is not null);
create policy er_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'erfolge' and (storage.foldername(name))[1] = public.my_email());
create policy er_delete on storage.objects for delete to authenticated using (
  bucket_id = 'erfolge' and ((storage.foldername(name))[1] = public.my_email() or public.is_lead()));
