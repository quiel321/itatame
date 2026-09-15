-- Auditoria e estado de estornos integrais de inscrições.
begin;

alter table public.inscricoes
  add column if not exists estorno_status text,
  add column if not exists estorno_valor numeric(10,2),
  add column if not exists estorno_refund_id text,
  add column if not exists estorno_motivo text,
  add column if not exists estornado_em timestamptz,
  add column if not exists estornado_por uuid;

do $$ begin
  alter table public.inscricoes add constraint inscricoes_estorno_status_check
    check (estorno_status is null or estorno_status in ('processando','estornado','erro'));
exception when duplicate_object then null; end $$;

create table if not exists public.inscricao_estornos (
  id uuid primary key default gen_random_uuid(),
  inscricao_id bigint not null unique references public.inscricoes(id) on delete restrict,
  evento_id uuid not null references public.eventos(id) on delete restrict,
  mp_payment_id text not null,
  valor numeric(10,2) not null check (valor > 0),
  status text not null check (status in ('processando','estornado','erro')),
  solicitado_por uuid not null,
  papel_solicitante text not null check (papel_solicitante in ('organizador','super-admin')),
  motivo text not null,
  mp_refund_id text,
  mp_status text,
  erro text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists inscricao_estornos_evento_criado
  on public.inscricao_estornos(evento_id, criado_em desc);

alter table public.inscricao_estornos enable row level security;
revoke all on public.inscricao_estornos from anon, authenticated;
grant all on public.inscricao_estornos to service_role;

notify pgrst, 'reload schema';
commit;
