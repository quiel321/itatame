-- Uma inscrição pode receber novo pagamento após um estorno. Preserve cada
-- transação estornada como registro separado na auditoria.
begin;

alter table public.inscricao_estornos
  drop constraint if exists inscricao_estornos_inscricao_id_key;

create unique index if not exists inscricao_estornos_inscricao_pagamento_key
  on public.inscricao_estornos (inscricao_id, mp_payment_id);

notify pgrst, 'reload schema';
commit;
