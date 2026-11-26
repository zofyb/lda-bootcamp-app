-- Update 10: Profilbilder (klein gerechnet in der App, max. 300 KB je Bild)
-- In Supabase: SQL Editor > New query > alles einfügen > Run

alter table public.members add column if not exists avatar text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profilbilder', 'profilbilder', false, 300000, array['image/jpeg','image/webp'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists pb_read   on storage.objects;
drop policy if exists pb_insert on storage.objects;
drop policy if exists pb_delete on storage.objects;
-- Alle Mitglieder der App dürfen Profilbilder sehen
create policy pb_read on storage.objects for select to authenticated using (
  bucket_id = 'profilbilder' and public.my_role() is not null);
-- Jede*r lädt nur in den eigenen Ordner
create policy pb_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'profilbilder' and (storage.foldername(name))[1] = public.my_email());
create policy pb_delete on storage.objects for delete to authenticated using (
  bucket_id = 'profilbilder' and ((storage.foldername(name))[1] = public.my_email() or public.is_lead()));

-- Eigenes Profilbild setzen oder entfernen (nur eigener Ordner)
create or replace function public.set_avatar(p text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.my_role() is null then raise exception 'kein Zugang'; end if;
  if p is not null and (char_length(p) > 200 or p not like public.my_email() || '/%') then raise exception 'ungültiger Pfad'; end if;
  update public.members set avatar = p where email = public.my_email();
end $$;
revoke all on function public.set_avatar(text) from public, anon;
grant execute on function public.set_avatar(text) to authenticated;
