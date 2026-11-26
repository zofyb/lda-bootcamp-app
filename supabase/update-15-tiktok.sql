-- Update 15: TikTok-Tippvideos speichern erlauben
-- (Die Datenbank kannte die Art "tiktok" noch nicht, deshalb wurde das Video abgelehnt.)
-- In Supabase: SQL Editor > New query > alles einfügen > Run
alter table public.extras drop constraint if exists extras_kind_check;
alter table public.extras add constraint extras_kind_check check (kind in ('extra','reward','tiktok'));
