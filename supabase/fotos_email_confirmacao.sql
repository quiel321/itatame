-- iTatame Fotos - controle de envio da confirmação de compra
-- Pode ser executado mais de uma vez sem duplicar colunas.

alter table public.foto_pedidos
  add column if not exists email_confirmacao_enviado_em timestamptz,
  add column if not exists email_confirmacao_erro text;

create index if not exists idx_foto_pedidos_email_confirmacao
  on public.foto_pedidos (status, email_confirmacao_enviado_em)
  where status = 'pago';
