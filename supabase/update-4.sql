-- Update 4: Extras (Info-Handouts ohne Punkte, immer offen)
-- In Supabase: SQL Editor > New query > alles einfügen > Run

create table if not exists public.extras (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  note       text,
  path       text not null,
  area       int references public.areas(n) on delete set null,
  sort       int not null default 0,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.extras to authenticated;
revoke all on public.extras from anon;
alter table public.extras enable row level security;

drop policy if exists extras_read  on public.extras;
drop policy if exists extras_write on public.extras;
create policy extras_read  on public.extras for select to authenticated using (public.my_role() is not null);
create policy extras_write on public.extras for all to authenticated using (public.is_lead()) with check (public.is_lead());
