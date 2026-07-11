-- iTatame Fotos - checkout, split e liberacao de downloads
-- Execute depois de fotos_seguranca_e_perfis.sql.

alter table public.foto_pedidos
  add column if not exists fotografo_id uuid references public.fotografos(id) on delete set null,
  add column if not exists subtotal_centavos integer not null default 0 check (subtotal_centavos >= 0),
  add column if not exists desconto_centavos integer not null default 0 check (desconto_centavos >= 0),
  add column if not exists comissao_itatame_centavos integer not null default 0 check (comissao_itatame_centavos >= 0),
  add column if not exists provedor_status_detail text;

create index if not exists idx_foto_pedidos_payment_id
  on public.foto_pedidos(provedor_payment_id);
create index if not exists idx_foto_pedidos_fotografo
  on public.foto_pedidos(fotografo_id, created_at desc);

drop policy if exists foto_pedido_itens_own_insert on public.foto_pedido_itens;
create policy foto_pedido_itens_own_insert
  on public.foto_pedido_itens for insert with check (
    exists (
      select 1 from public.foto_pedidos p
      where p.id = pedido_id and p.comprador_user_id = auth.uid()
    )
  );

