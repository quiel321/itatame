-- Guarda a justificativa da categoria oficial atribuída pelo organizador.
-- Não modifica categorias, pagamentos ou inscrições existentes.
alter table public.inscricoes
  add column if not exists categoria_ajuste_motivo text,
  add column if not exists categoria_ajuste_por uuid,
  add column if not exists categoria_ajuste_em timestamptz;
