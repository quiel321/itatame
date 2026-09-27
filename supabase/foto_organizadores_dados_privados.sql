-- Dados financeiros do organizador Retratt separados do perfil público.
create table if not exists public.foto_organizadores_privado (
  id uuid primary key references public.foto_organizadores(id) on delete cascade,
  email text,
  telefone text,
  documento text,
  tipo_entidade text,
  academia text,
  perfil_completo boolean not null default false
);

alter table public.foto_organizadores_privado enable row level security;

create policy foto_organizadores_privado_select on public.foto_organizadores_privado
  for select to authenticated using (id = auth.uid());
create policy foto_organizadores_privado_insert on public.foto_organizadores_privado
  for insert to authenticated with check (id = auth.uid());
create policy foto_organizadores_privado_update on public.foto_organizadores_privado
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
