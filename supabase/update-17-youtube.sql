-- Update 17: Akademie-Inhalte dürfen neben TikTok- auch YouTube-Links haben (Schulungsaufzeichnungen, nicht gelistet)
-- In Supabase: SQL Editor > New query > alles einfügen > Run

alter table public.extras drop constraint if exists extras_link_tiktok;
alter table public.extras add constraint extras_link_tiktok check (
  link is null
  or link ~ '^https://(www\.|vm\.|vt\.)?tiktok\.com/'
  or link ~ '^https://(www\.|m\.)?(youtube\.com|youtu\.be)/'
);
