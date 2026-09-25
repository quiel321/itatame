-- Executar antes de publicar o limite de 50% no painel Retratt.
-- Mantem os valores historicos dos pedidos e altera apenas os limites futuros.
begin;
-- Remove apenas as restricoes de 15% criadas pelos scripts anteriores.
-- Outras validacoes dessas tabelas permanecem intactas.
alter table public.foto_evento_fotografos
  drop constraint if exists foto_evento_fotografos_comissao_organizador_percentual_check,
  drop constraint if exists foto_evento_fotografos_royalty_lte_15;

alter table public.foto_pedidos
  drop constraint if exists foto_pedidos_comissao_organizador_percentual_check;

alter table public.foto_royalties_organizador
  drop constraint if exists foto_royalties_organizador_percentual_check;

alter table public.foto_evento_fotografos
  add constraint foto_evento_fotografos_royalty_0_50
  check (comissao_organizador_percentual between 0 and 50);

alter table public.foto_pedidos
  add constraint foto_pedidos_royalty_0_50
  check (comissao_organizador_percentual between 0 and 50);

alter table public.foto_royalties_organizador
  add constraint foto_royalties_organizador_percentual_0_50
  check (percentual > 0 and percentual <= 50);

commit;
