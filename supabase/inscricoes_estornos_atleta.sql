-- Permite auditar cancelamentos com estorno solicitados pelo atleta ou responsável.
alter table public.inscricao_estornos drop constraint if exists inscricao_estornos_papel_solicitante_check;
alter table public.inscricao_estornos add constraint inscricao_estornos_papel_solicitante_check
  check (papel_solicitante in ('organizador', 'super-admin', 'atleta'));
