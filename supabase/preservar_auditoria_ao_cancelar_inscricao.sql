-- Permite remover uma inscrição após o cancelamento de um novo pagamento
-- pendente, sem perder a auditoria de um estorno anterior.
begin;

alter table public.inscricao_estornos
  add column if not exists inscricao_id_original bigint;

update public.inscricao_estornos
  set inscricao_id_original = inscricao_id
  where inscricao_id_original is null;

alter table public.inscricao_estornos
  alter column inscricao_id drop not null;

alter table public.inscricao_estornos
  drop constraint if exists inscricao_estornos_inscricao_id_fkey;

alter table public.inscricao_estornos
  add constraint inscricao_estornos_inscricao_id_fkey
  foreign key (inscricao_id) references public.inscricoes(id) on delete set null;

create index if not exists inscricao_estornos_inscricao_original_idx
  on public.inscricao_estornos(inscricao_id_original);

notify pgrst, 'reload schema';
commit;
