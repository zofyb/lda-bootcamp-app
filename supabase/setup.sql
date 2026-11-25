-- LDA Creator Bootcamp: Datenbank einrichten
-- In Supabase: SQL Editor > New query > alles einfügen > Run.
-- WICHTIG: Ganz unten DEINE E-Mail-Adresse eintragen (Zeile mit 'DEINE@EMAIL.DE').

create extension if not exists pgcrypto;

-- ---------- Tabellen ----------
create table if not exists public.members (
  email         text primary key check (email = lower(email)),
  role          text not null check (role in ('creator','manager','lead')),
  name          text not null,
  handle        text,
  manager_email text references public.members(email) on update cascade on delete set null,
  created_at    timestamptz not null default now()
);

create table if not exists public.areas (
  n            int primary key,
  title        text not null,
  week         int not null,
  deadline     date,
  video_url    text,
  handout_path text,
  intro        text,
  pre          jsonb not null default '[]',
  p1           jsonb not null default '[]',
  p2           jsonb not null default '[]',
  proof        text
);

create table if not exists public.submissions (
  id            uuid primary key default gen_random_uuid(),
  creator_email text not null references public.members(email) on update cascade on delete cascade,
  area          int  not null references public.areas(n) on delete cascade,
  note          text,
  files         jsonb not null default '[]',
  submitted_at  timestamptz not null default now(),
  points        int check (points between 0 and 2),
  feedback      text,
  rated_by      text,
  rated_at      timestamptz,
  unique (creator_email, area)
);

-- ---------- Hilfsfunktionen ----------
create or replace function public.my_email() returns text
language sql stable as $$ select lower(coalesce(auth.jwt()->>'email','')) $$;

create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as
$$ select role from public.members where email = public.my_email() $$;

create or replace function public.is_lead() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce(public.my_role() = 'lead', false) $$;

create or replace function public.manages(c text) returns boolean
language sql stable security definer set search_path = public as
$$ select exists(select 1 from public.members where email = lower(c) and manager_email = public.my_email()) $$;

create or replace function public.my_manager() returns text
language sql stable security definer set search_path = public as
$$ select manager_email from public.members where email = public.my_email() $$;

-- Vor dem Login: steht die Adresse auf der Liste? (verhindert fremde Anmeldungen)
create or replace function public.is_member(e text) returns boolean
language sql stable security definer set search_path = public as
$$ select exists(select 1 from public.members where email = lower(trim(e))) $$;
grant execute on function public.is_member(text) to anon, authenticated;

-- Punkte vergeben (Manager für eigene Creator, Geschäftsführung für alle)
create or replace function public.rate_submission(sub_id uuid, pts int, fb text)
returns void language plpgsql security definer set search_path = public as $$
declare c text;
begin
  select creator_email into c from public.submissions where id = sub_id;
  if c is null then raise exception 'Abgabe nicht gefunden'; end if;
  if not (public.is_lead() or public.manages(c)) then raise exception 'Keine Berechtigung'; end if;
  if pts is not null and (pts < 0 or pts > 2) then raise exception 'Punkte 0 bis 2'; end if;
  update public.submissions
     set points = pts, feedback = nullif(trim(fb),''), rated_by = public.my_email(), rated_at = now()
   where id = sub_id;
end $$;
grant execute on function public.rate_submission(uuid,int,text) to authenticated;

-- ---------- Rechte (unabhängig von den Projekt-Voreinstellungen) ----------
grant usage on schema public to anon, authenticated;
revoke all on public.members, public.areas, public.submissions from anon;
grant select, insert, update, delete on public.members, public.areas, public.submissions to authenticated;
grant execute on function public.my_email(), public.my_role(), public.is_lead(), public.manages(text), public.my_manager() to authenticated;

-- ---------- Zugriffsregeln ----------
alter table public.members     enable row level security;
alter table public.areas       enable row level security;
alter table public.submissions enable row level security;

drop policy if exists members_read  on public.members;
drop policy if exists members_write on public.members;
create policy members_read on public.members for select to authenticated using (
  email = public.my_email() or public.is_lead() or manager_email = public.my_email() or email = public.my_manager()
);
create policy members_write on public.members for all to authenticated
  using (public.is_lead()) with check (public.is_lead());

drop policy if exists areas_read  on public.areas;
drop policy if exists areas_write on public.areas;
create policy areas_read on public.areas for select to authenticated using (public.my_role() is not null);
create policy areas_write on public.areas for all to authenticated
  using (public.is_lead()) with check (public.is_lead());

drop policy if exists subs_read          on public.submissions;
drop policy if exists subs_insert        on public.submissions;
drop policy if exists subs_update_own    on public.submissions;
drop policy if exists subs_delete_lead   on public.submissions;
create policy subs_read on public.submissions for select to authenticated using (
  creator_email = public.my_email() or public.is_lead() or public.manages(creator_email)
);
-- Creator geben nur für sich ab, und nur wenn das vorherige Thema abgegeben ist
create policy subs_insert on public.submissions for insert to authenticated with check (
  creator_email = public.my_email()
  and public.my_role() = 'creator'
  and points is null and rated_by is null
  and (submissions.area = 1 or exists (
        select 1 from public.submissions s
        where s.creator_email = public.my_email() and s.area = submissions.area - 1))
);
-- Nachweise ergänzen geht, solange noch nicht bewertet
create policy subs_update_own on public.submissions for update to authenticated
  using (creator_email = public.my_email() and points is null)
  with check (creator_email = public.my_email() and points is null and rated_by is null);
create policy subs_delete_lead on public.submissions for delete to authenticated using (public.is_lead());

-- ---------- Dateiablage ----------
insert into storage.buckets (id, name, public, file_size_limit)
values ('nachweise','nachweise', false, 52428800),
       ('unterlagen','unterlagen', false, 52428800)
on conflict (id) do nothing;

drop policy if exists nachweise_insert on storage.objects;
drop policy if exists nachweise_read   on storage.objects;
drop policy if exists nachweise_delete on storage.objects;
drop policy if exists unterlagen_read  on storage.objects;
drop policy if exists unterlagen_write on storage.objects;

create policy nachweise_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'nachweise' and (storage.foldername(name))[1] = public.my_email()
);
create policy nachweise_read on storage.objects for select to authenticated using (
  bucket_id = 'nachweise' and (
    (storage.foldername(name))[1] = public.my_email()
    or public.is_lead()
    or public.manages((storage.foldername(name))[1]))
);
create policy nachweise_delete on storage.objects for delete to authenticated using (
  bucket_id = 'nachweise' and ((storage.foldername(name))[1] = public.my_email() or public.is_lead())
);
create policy unterlagen_read on storage.objects for select to authenticated using (
  bucket_id = 'unterlagen' and public.my_role() is not null
);
create policy unterlagen_write on storage.objects for all to authenticated
  using (bucket_id = 'unterlagen' and public.is_lead())
  with check (bucket_id = 'unterlagen' and public.is_lead());

-- ---------- Themen (können später in der App unter "Themen" geändert werden) ----------
insert into public.areas (n, title, week, intro, pre, p1, p2, proof) values
(1,'App-Grundlagen',1,'Richte dein Profil und deine Live-Werkzeuge so ein, dass Zuschauer dich finden und unterstützen können.',
 '[]',
 '["2-Schritt-Verifizierung an (Einstellungen → Sicherheit)","Profilbild: dein Gesicht, hell und gut erkennbar","Bio neu: Wer bist du, was machst du, wann bist du live?","Live-Ziel mind. 1× im Live gesetzt","Geschenktüte mind. 1× im Live eingesetzt"]',
 '["Moderatoreinstellungen festgelegt","Kommentarfilter geprüft","Lives in der Bio angekündigt (mit Uhrzeit)","Live-Ziel und Geschenktüte regelmäßig genutzt, nicht nur 1×"]',
 'Screenshots von Profil, aus deinem Live und von den Sicherheitseinstellungen'),
(2,'Videoproduktion',1,'Videos bringen neue Zuschauer in deine Lives. Finde deine Nische und nutze starke Hooks.',
 '["Nische finden: 3 Themen, für die dein Kanal steht","5 Videoideen zu diesen Themen notieren"]',
 '["Mind. 1 Video gepostet: mit Hook, im Hochformat, mit Untertiteln"]',
 '["Mind. 2 Videos mit der 3-Hook-Regel gepostet (Ton, Text, Bewegung)","Nach 2–3 Tagen ausgewertet: Lief es? Wenn nein, warum?"]',
 'Links zu deinen Videos und eine kurze Auswertung'),
(3,'Anlaufvideo',2,'Ein kurzes Video 15–60 Minuten vor dem Live holt deine Zuschauer ab.',
 '[]',
 '["In dieser Woche vor den meisten Lives ein Anlaufvideo gepostet (15–60 Min. vorher)"]',
 '["Vor JEDEM Live ein Anlaufvideo gepostet","Darin: Uhrzeit, Plan fürs Live und Call to Action"]',
 'Screenshot deines Profils und ein Beispielvideo'),
(4,'Hintergrund & Setup',2,'Dein Hintergrund ist der erste Eindruck. Aufgeräumt, stimmig, wiedererkennbar.',
 '[]',
 '["Hintergrund aufgeräumt, Störendes entfernt","War er schon gut: eine Sache bewusst verändert (z. B. Overlay)"]',
 '["Stimmiger Look, deutlich besser als vorher","Oder Neues ausprobiert und mit deinem Manager besprochen"]',
 'Vorher-Nachher-Foto'),
(5,'Beleuchtung',3,'Gutes Licht macht dein Live sofort hochwertiger.',
 '[]',
 '["Licht kommt von vorne","Kein starkes Gegenlicht (kein Fenster im Rücken)"]',
 '["Gesicht gleichmäßig hell, ohne harte Schatten","In jedem Live gleich gut, auch abends"]',
 'Screenshot aus einem Abend-Live'),
(6,'Livezeit & Aktivität',3,'Feste Live-Zeiten machen dich verlässlich für deine Community.',
 '[]',
 '["Live-Tage und Zeiten mit deinem Manager festgelegt","Plan in die Bio geschrieben"]',
 '["Plan in Woche 4 durchgezogen","Ausfälle vorher angekündigt"]',
 'Screenshot deiner Bio mit Plan und deine Live-Daten aus Woche 4'),
(7,'Auftreten',4,'Ein starker Start und gute Gesprächsaufhänger halten Zuschauer im Live.',
 '["Starker Start in den ersten 60 Sekunden: 1. Begrüßung, 2. Ansage, was heute passiert, 3. klares Ziel"]',
 '["Mitschnitt deiner ersten 60 Sekunden","3 Gesprächsaufhänger: 3 offene Fragen, die du in deinem Live stellst"]',
 '["Derselbe 60-Sekunden-Mitschnitt enthält alle 3 Teile","Selbst-Check: Wo hätte ich Grenzen setzen oder führen müssen? Wie werde ich wahrgenommen? Was ändere ich nächstes Mal?"]',
 'Mitschnitt der ersten 60 Sekunden, deine 3 Fragen und dein Selbst-Check'),
(8,'Motivation & Umsetzung',4,'Mit einem klaren Plan geht es nach dem Bootcamp weiter.',
 '[]',
 '["Dezember-Plan erstellt (Live-Tage, Uhrzeiten)","Mit deinem Manager über Videos pro Woche und deine 2 Bootcamp-Dinge gesprochen"]',
 '["Zusätzlich dein Dezember-Special und die Ankündigung mit deinem Manager besprochen"]',
 'Dein Plan und das Gespräch mit deinem Manager')
on conflict (n) do nothing;

-- ---------- Deine E-Mail als Geschäftsführung ----------
insert into public.members (email, role, name)
values (lower('DEINE@EMAIL.DE'), 'lead', 'Zofy')
on conflict (email) do update set role = 'lead';

-- Größere Dateien (Lehrvideos bis 50 MB) in "unterlagen" erlauben
update storage.buckets set file_size_limit = 52428800 where id = 'unterlagen';
