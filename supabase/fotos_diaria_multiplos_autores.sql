-- Metadado financeiro para NOVOS pedidos. Não recalcula nem modifica vendas anteriores.
begin;
set local lock_timeout = '5s';
alter table public.foto_pedidos
  add column if not exists vendas_fotografos jsonb
  check (vendas_fotografos is null or jsonb_typeof(vendas_fotografos) = 'array');
comment on column public.foto_pedidos.vendas_fotografos is
  'Autoria e rateio em centavos no momento da compra por diaria; valores antes da tarifa MP. Pedidos antigos permanecem nulos.';
commit;
