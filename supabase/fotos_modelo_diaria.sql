-- Executar antes de publicar o modelo de diaria da Retratt.
begin;

alter table public.foto_evento_fotografos
  add column if not exists modelo_recebimento text not null default 'royalty'
  check (modelo_recebimento in ('royalty', 'diaria_organizador'));

alter table public.foto_pedidos
  add column if not exists modelo_recebimento text not null default 'royalty'
  check (modelo_recebimento in ('royalty', 'diaria_organizador')),
  add column if not exists receita_direta_organizador_centavos integer not null default 0
  check (receita_direta_organizador_centavos >= 0);

create table if not exists public.foto_mp_organizadores (
  user_id uuid primary key references auth.users(id) on delete cascade,
  mp_access_token text not null,
  mp_refresh_token text,
  mp_public_key text,
  mp_user_id text,
  mp_token_expires_at timestamptz,
  mp_connected_at timestamptz not null default now(),
  mp_scope text,
  mp_live_mode boolean,
  updated_at timestamptz not null default now()
);

alter table public.foto_mp_organizadores enable row level security;
revoke all on public.foto_mp_organizadores from anon, authenticated;
grant all on public.foto_mp_organizadores to service_role;

-- Pedidos e itens sao criados exclusivamente no checkout autenticado do servidor.
-- A antiga policy de insert permitia forjar valores financeiros pelo cliente.
drop policy if exists foto_pedidos_own_insert on public.foto_pedidos;
drop policy if exists foto_pedido_itens_own_insert on public.foto_pedido_itens;
revoke insert on public.foto_pedidos, public.foto_pedido_itens from anon, authenticated;

commit;
