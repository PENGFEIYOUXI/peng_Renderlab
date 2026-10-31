-- HAO PENG RENDERLAB: Supabase schema + access control
-- 1) Create a Supabase project and an Auth user for yourself (Authentication > Users).
-- 2) Replace YOUR_ADMIN_USER_UUID below with that user's UUID, then run this SQL in SQL Editor.
-- 3) Never put the service_role key in config.js or any browser code.

create extension if not exists pgcrypto;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  project_no text not null default '',
  status text not null default 'PLANNED'
    check (status in ('COMPLETED','IN PROGRESS','PLANNED')),
  title text not null,
  description text not null default '',
  tags text[] not null default '{}',
  image_url text,
  demo_url text,
  github_url text,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.projects enable row level security;

drop policy if exists "Public can read portfolio projects" on public.projects;
create policy "Public can read portfolio projects"
on public.projects for select
to anon, authenticated
using (true);

drop policy if exists "Only owner can insert projects" on public.projects;
create policy "Only owner can insert projects"
on public.projects for insert
to authenticated
with check (auth.uid() = 'YOUR_ADMIN_USER_UUID'::uuid);

drop policy if exists "Only owner can update projects" on public.projects;
create policy "Only owner can update projects"
on public.projects for update
to authenticated
using (auth.uid() = 'YOUR_ADMIN_USER_UUID'::uuid)
with check (auth.uid() = 'YOUR_ADMIN_USER_UUID'::uuid);

drop policy if exists "Only owner can delete projects" on public.projects;
create policy "Only owner can delete projects"
on public.projects for delete
to authenticated
using (auth.uid() = 'YOUR_ADMIN_USER_UUID'::uuid);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists projects_updated_at on public.projects;
create trigger projects_updated_at before update on public.projects
for each row execute function public.set_updated_at();

-- Public image delivery; upload/update/delete are restricted to the same admin UUID.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('portfolio-media','portfolio-media',true,10485760,array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set public=true, file_size_limit=10485760,
  allowed_mime_types=array['image/png','image/jpeg','image/webp'];

drop policy if exists "Public can view portfolio media" on storage.objects;
create policy "Public can view portfolio media"
on storage.objects for select to anon, authenticated
using (bucket_id='portfolio-media');

drop policy if exists "Only owner can upload portfolio media" on storage.objects;
create policy "Only owner can upload portfolio media"
on storage.objects for insert to authenticated
with check (bucket_id='portfolio-media' and auth.uid() = 'YOUR_ADMIN_USER_UUID'::uuid
  and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Only owner can update portfolio media" on storage.objects;
create policy "Only owner can update portfolio media"
on storage.objects for update to authenticated
using (bucket_id='portfolio-media' and auth.uid() = 'YOUR_ADMIN_USER_UUID'::uuid
  and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id='portfolio-media' and auth.uid() = 'YOUR_ADMIN_USER_UUID'::uuid
  and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Only owner can delete portfolio media" on storage.objects;
create policy "Only owner can delete portfolio media"
on storage.objects for delete to authenticated
using (bucket_id='portfolio-media' and auth.uid() = 'YOUR_ADMIN_USER_UUID'::uuid
  and (storage.foldername(name))[1] = auth.uid()::text);

-- Starter project: the actual OpenGL lightsaber model rendering project.
insert into public.projects(project_no,status,title,description,tags,sort_order)
values (
 '01 / OPENGL','COMPLETED','OpenGL 光剑模型实时渲染',
 '基于 OpenGL API 的实时渲染项目，以自建光剑模型作为视觉主体。可在项目详情中持续补充模型加载、相机、光照、材质、发光效果与渲染管线实现。',
 array['OpenGL','C++','GLSL','3D Model','Real-time Rendering'],1
)
on conflict do nothing;
