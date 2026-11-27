-- Update 20: Tagesbonus
-- Beim ersten Öffnen am Tag holen sich Creator UND Manager ihre Punkte im Fenster ab: +5 pro Tag,
-- am 7. Tag in Folge zusätzlich +25 (Wochenbonus). Alle anderen XP bleiben wie bisher nur für Creator.
-- Kann gefahrlos mehrfach ausgeführt werden. In Supabase: SQL Editor > New query > alles einfügen > Run

create or replace function public.award_xp(k text, r text)
returns int language plpgsql security definer set search_path = public as $$
declare pts int; me text := public.my_email(); n int; rl text := public.my_role();
        today date := (now() at time zone 'Europe/Berlin')::date;
begin
  if coalesce(rl,'') not in ('creator','manager') then return 0; end if;
  if rl = 'manager' and k not in ('login','streak') then return 0; end if;
  if r is null or char_length(r) > 80 then return 0; end if;
  pts := case k
    when 'login'  then 5     -- ref = Tag (JJJJ-MM-TT)
    when 'streak' then 25    -- ref = Tag, 7. Tag in Folge
    when 'hook'   then 10
    when 'impuls' then 20
    when 'iq1'    then 10
    when 'iq2'    then 10
    when 'iq3'    then 10
    when 'camp'   then 15
    when 'extra'  then 15
    else 0 end;
  if pts = 0 then return 0; end if;
  if k in ('login','hook','streak') and r <> to_char(today, 'YYYY-MM-DD') then return 0; end if;
  if k = 'streak' then
    -- die 6 Tage davor jeweils abgeholt, heute abgeholt, und in diesen 6 Tagen kein Wochenbonus
    if (select count(distinct ref) from public.xp_events where creator_email = me and kind = 'login'
          and ref between to_char(today - 6, 'YYYY-MM-DD') and to_char(today - 1, 'YYYY-MM-DD')) < 6 then return 0; end if;
    if not exists (select 1 from public.xp_events where creator_email = me and kind = 'login' and ref = r) then return 0; end if;
    if exists (select 1 from public.xp_events where creator_email = me and kind = 'streak'
          and ref between to_char(today - 6, 'YYYY-MM-DD') and to_char(today - 1, 'YYYY-MM-DD')) then return 0; end if;
  end if;
  if k = 'camp'  and not exists(select 1 from public.calendar where id::text = r and audience = 'all') then return 0; end if;
  if k = 'extra' and not exists(select 1 from public.extras where id::text = r) then return 0; end if;
  insert into public.xp_events(creator_email, kind, ref, xp) values (me, k, r, pts) on conflict do nothing;
  get diagnostics n = row_count;
  return case when n > 0 then pts else 0 end;
end $$;
revoke all on function public.award_xp(text, text) from public, anon;
grant execute on function public.award_xp(text, text) to authenticated;
