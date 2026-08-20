-- ============================================================
-- Planificador Semanal · Foundations — configuración de Supabase
-- Pega todo este bloque en Supabase → SQL Editor → Run (una sola vez)
-- ============================================================

-- Tabla de semanas guardadas
create table if not exists public.weeks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  week_number int not null,
  payload jsonb not null,
  saved_at timestamptz not null default now()
);

alter table public.weeks enable row level security;

create policy "weeks_owner_select" on public.weeks
  for select using (auth.uid() = user_id);
create policy "weeks_owner_insert" on public.weeks
  for insert with check (auth.uid() = user_id);
create policy "weeks_owner_update" on public.weeks
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "weeks_owner_delete" on public.weeks
  for delete using (auth.uid() = user_id);

-- Tabla de configuración fija (encabezado / pie de página / logo)
create table if not exists public.app_config (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_config enable row level security;

create policy "config_owner_select" on public.app_config
  for select using (auth.uid() = user_id);
create policy "config_owner_insert" on public.app_config
  for insert with check (auth.uid() = user_id);
create policy "config_owner_update" on public.app_config
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Bucket de almacenamiento para el logo y las imágenes de la línea de tiempo
insert into storage.buckets (id, name, public)
values ('assets', 'assets', true)
on conflict (id) do nothing;

create policy "assets_public_read" on storage.objects
  for select using (bucket_id = 'assets');
create policy "assets_auth_insert" on storage.objects
  for insert with check (bucket_id = 'assets' and auth.role() = 'authenticated');
create policy "assets_auth_update" on storage.objects
  for update using (bucket_id = 'assets' and auth.role() = 'authenticated');
create policy "assets_auth_delete" on storage.objects
  for delete using (bucket_id = 'assets' and auth.role() = 'authenticated');
