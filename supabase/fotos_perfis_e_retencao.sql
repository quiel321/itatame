-- iTatame Fotos - perfis de usuários e retenção das galerias

alter table public.fotografos
  add column if not exists cep text,
  add column if not exists endereco text,
  add column if not exists cidade text,
  add column if not exists estado text,
  add column if not exists perfil_completo boolean not null default false;

alter table public.organizadores
  add column if not exists tipo_entidade text,
  add column if not exists perfil_completo boolean not null default false;

create table if not exists public.foto_compradores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  nome text not null,
  email text,
  telefone text,
  perfil_completo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.foto_eventos
  add column if not exists vendas_ate timestamptz,
  add column if not exists desconto_combo_qtd integer not null default 3 check (desconto_combo_qtd >= 2),
  add column if not exists desconto_combo_percentual numeric(5,2) not null default 20 check (desconto_combo_percentual >= 0 and desconto_combo_percentual <= 90),
  add column if not exists retencao_dias integer not null default 90 check (retencao_dias >= 7);

alter table public.foto_arquivos
  add column if not exists excluir_em timestamptz;

create index if not exists idx_foto_compradores_user_id on public.foto_compradores(user_id);
create index if not exists idx_foto_eventos_vendas_ate on public.foto_eventos(vendas_ate);
create index if not exists idx_foto_arquivos_excluir_em on public.foto_arquivos(excluir_em);

alter table public.foto_compradores enable row level security;

drop policy if exists foto_compradores_own_select on public.foto_compradores;
create policy foto_compradores_own_select on public.foto_compradores
  for select using (user_id = auth.uid());

drop policy if exists foto_compradores_own_insert on public.foto_compradores;
create policy foto_compradores_own_insert on public.foto_compradores
  for insert with check (user_id = auth.uid());

drop policy if exists foto_compradores_own_update on public.foto_compradores;
create policy foto_compradores_own_update on public.foto_compradores
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
