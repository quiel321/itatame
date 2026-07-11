create extension if not exists pgcrypto;

create table if not exists public.fotografos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  nome text not null,
  email text,
  telefone text,
  documento text,
  cep text,
  endereco text,
  cidade text,
  estado text,
  foto_url text,
  bio text,
  mp_access_token text,
  mp_refresh_token text,
  mp_public_key text,
  mp_user_id text,
  mp_token_expires_at timestamptz,
  mp_connected_at timestamptz,
  mp_scope text,
  mp_live_mode boolean not null default false,
  perfil_completo boolean not null default false,
  status text not null default 'pendente' check (status in ('pendente', 'ativo', 'bloqueado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

create table if not exists public.foto_eventos (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid,
  organizador_user_id uuid references auth.users(id) on delete set null,
  nome text not null,
  slug text unique,
  descricao text,
  local text,
  cidade text,
  estado text,
  data_evento date,
  capa_url text,
  status text not null default 'rascunho' check (status in ('rascunho', 'publicado', 'arquivado')),
  preco_padrao_centavos integer not null default 1500 check (preco_padrao_centavos >= 0),
  permite_download_gratis boolean not null default false,
  vendas_ate timestamptz,
  desconto_combo_qtd integer not null default 3 check (desconto_combo_qtd >= 2),
  desconto_combo_percentual numeric(5,2) not null default 20 check (desconto_combo_percentual >= 0 and desconto_combo_percentual <= 90),
  retencao_dias integer not null default 90 check (retencao_dias >= 7),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.foto_albuns (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.foto_eventos(id) on delete cascade,
  fotografo_id uuid references public.fotografos(id) on delete set null,
  titulo text not null,
  descricao text,
  capa_url text,
  status text not null default 'rascunho' check (status in ('rascunho', 'publicado', 'arquivado')),
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.foto_arquivos (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.foto_eventos(id) on delete cascade,
  album_id uuid references public.foto_albuns(id) on delete set null,
  fotografo_id uuid references public.fotografos(id) on delete set null,
  titulo text,
  nome_original text,
  mime_type text,
  tamanho_bytes bigint,
  largura integer,
  altura integer,
  r2_original_key text not null,
  r2_preview_key text,
  r2_thumb_key text,
  preview_url text,
  thumb_url text,
  hash_arquivo text,
  preco_centavos integer not null default 1500 check (preco_centavos >= 0),
  status text not null default 'processando' check (status in ('processando', 'publicada', 'vendida', 'oculta', 'erro')),
  tags text[] not null default '{}',
  numero_peito text,
  atleta_nome text,
  atleta_id bigint,
  comprador_user_id uuid references auth.users(id) on delete set null,
  excluir_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.foto_pedidos (
  id uuid primary key default gen_random_uuid(),
  comprador_user_id uuid references auth.users(id) on delete set null,
  comprador_email text,
  comprador_nome text,
  evento_id uuid references public.foto_eventos(id) on delete set null,
  status text not null default 'pendente' check (status in ('pendente', 'pago', 'cancelado', 'reembolsado')),
  total_centavos integer not null default 0 check (total_centavos >= 0),
  provedor_pagamento text,
  provedor_payment_id text,
  provedor_preference_id text,
  pago_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.foto_pedido_itens (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.foto_pedidos(id) on delete cascade,
  foto_id uuid not null references public.foto_arquivos(id) on delete restrict,
  preco_centavos integer not null default 0 check (preco_centavos >= 0),
  download_liberado boolean not null default false,
  download_expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique (pedido_id, foto_id)
);

create table if not exists public.foto_downloads (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.foto_pedido_itens(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  ip inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_fotografos_user_id on public.fotografos(user_id);
create index if not exists idx_fotografos_mp_user_id on public.fotografos(mp_user_id);
create index if not exists idx_foto_compradores_user_id on public.foto_compradores(user_id);
create index if not exists idx_foto_eventos_status_data on public.foto_eventos(status, data_evento desc);
create index if not exists idx_foto_eventos_evento_id on public.foto_eventos(evento_id);
create index if not exists idx_foto_eventos_organizador_user_id on public.foto_eventos(organizador_user_id);
create index if not exists idx_foto_eventos_vendas_ate on public.foto_eventos(vendas_ate);
create index if not exists idx_foto_albuns_evento_id on public.foto_albuns(evento_id);
create index if not exists idx_foto_albuns_fotografo_id on public.foto_albuns(fotografo_id);
create index if not exists idx_foto_arquivos_evento_id on public.foto_arquivos(evento_id);
create index if not exists idx_foto_arquivos_album_id on public.foto_arquivos(album_id);
create index if not exists idx_foto_arquivos_fotografo_id on public.foto_arquivos(fotografo_id);
create index if not exists idx_foto_arquivos_excluir_em on public.foto_arquivos(excluir_em);
create index if not exists idx_foto_arquivos_atleta_id on public.foto_arquivos(atleta_id);
create index if not exists idx_foto_pedidos_comprador on public.foto_pedidos(comprador_user_id, created_at desc);
create index if not exists idx_foto_pedido_itens_pedido on public.foto_pedido_itens(pedido_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_fotografos_updated_at on public.fotografos;
create trigger set_fotografos_updated_at before update on public.fotografos for each row execute function public.set_updated_at();

drop trigger if exists set_foto_compradores_updated_at on public.foto_compradores;
create trigger set_foto_compradores_updated_at before update on public.foto_compradores for each row execute function public.set_updated_at();

drop trigger if exists set_foto_eventos_updated_at on public.foto_eventos;
create trigger set_foto_eventos_updated_at before update on public.foto_eventos for each row execute function public.set_updated_at();

drop trigger if exists set_foto_albuns_updated_at on public.foto_albuns;
create trigger set_foto_albuns_updated_at before update on public.foto_albuns for each row execute function public.set_updated_at();

drop trigger if exists set_foto_arquivos_updated_at on public.foto_arquivos;
create trigger set_foto_arquivos_updated_at before update on public.foto_arquivos for each row execute function public.set_updated_at();

drop trigger if exists set_foto_pedidos_updated_at on public.foto_pedidos;
create trigger set_foto_pedidos_updated_at before update on public.foto_pedidos for each row execute function public.set_updated_at();

alter table public.fotografos enable row level security;
alter table public.foto_compradores enable row level security;
alter table public.foto_eventos enable row level security;
alter table public.foto_albuns enable row level security;
alter table public.foto_arquivos enable row level security;
alter table public.foto_pedidos enable row level security;
alter table public.foto_pedido_itens enable row level security;
alter table public.foto_downloads enable row level security;

drop policy if exists fotografos_own_select on public.fotografos;
create policy fotografos_own_select on public.fotografos for select using (user_id = auth.uid());

drop policy if exists fotografos_own_insert on public.fotografos;
create policy fotografos_own_insert on public.fotografos for insert with check (user_id = auth.uid());

drop policy if exists fotografos_own_update on public.fotografos;
create policy fotografos_own_update on public.fotografos for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists foto_compradores_own_select on public.foto_compradores;
create policy foto_compradores_own_select on public.foto_compradores for select using (user_id = auth.uid());

drop policy if exists foto_compradores_own_insert on public.foto_compradores;
create policy foto_compradores_own_insert on public.foto_compradores for insert with check (user_id = auth.uid());

drop policy if exists foto_compradores_own_update on public.foto_compradores;
create policy foto_compradores_own_update on public.foto_compradores for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists foto_eventos_publicados_select on public.foto_eventos;
create policy foto_eventos_publicados_select on public.foto_eventos for select using (status = 'publicado');

drop policy if exists foto_eventos_owner_all on public.foto_eventos;
create policy foto_eventos_owner_all on public.foto_eventos for all using (created_by = auth.uid() or organizador_user_id = auth.uid()) with check (created_by = auth.uid() or organizador_user_id = auth.uid());

drop policy if exists foto_albuns_publicados_select on public.foto_albuns;
create policy foto_albuns_publicados_select on public.foto_albuns for select using (status = 'publicado');

drop policy if exists foto_albuns_fotografo_all on public.foto_albuns;
create policy foto_albuns_fotografo_all on public.foto_albuns for all using (exists (select 1 from public.fotografos f where f.id = foto_albuns.fotografo_id and f.user_id = auth.uid())) with check (exists (select 1 from public.fotografos f where f.id = foto_albuns.fotografo_id and f.user_id = auth.uid()));

drop policy if exists foto_arquivos_publicados_select on public.foto_arquivos;
create policy foto_arquivos_publicados_select on public.foto_arquivos for select using (status = 'publicada');

drop policy if exists foto_arquivos_fotografo_all on public.foto_arquivos;
create policy foto_arquivos_fotografo_all on public.foto_arquivos for all using (exists (select 1 from public.fotografos f where f.id = foto_arquivos.fotografo_id and f.user_id = auth.uid())) with check (exists (select 1 from public.fotografos f where f.id = foto_arquivos.fotografo_id and f.user_id = auth.uid()));

drop policy if exists foto_pedidos_own_select on public.foto_pedidos;
create policy foto_pedidos_own_select on public.foto_pedidos for select using (comprador_user_id = auth.uid());

drop policy if exists foto_pedidos_own_insert on public.foto_pedidos;
create policy foto_pedidos_own_insert on public.foto_pedidos for insert with check (comprador_user_id = auth.uid());

drop policy if exists foto_pedido_itens_own_select on public.foto_pedido_itens;
create policy foto_pedido_itens_own_select on public.foto_pedido_itens for select using (exists (select 1 from public.foto_pedidos p where p.id = foto_pedido_itens.pedido_id and p.comprador_user_id = auth.uid()));

drop policy if exists foto_downloads_own_insert on public.foto_downloads;
create policy foto_downloads_own_insert on public.foto_downloads for insert with check (user_id = auth.uid());

drop policy if exists foto_downloads_own_select on public.foto_downloads;
create policy foto_downloads_own_select on public.foto_downloads for select using (user_id = auth.uid());
