alter table public.organizadores
  add column if not exists plano_comercial text not null default 'essencial',
  add column if not exists comissao_percentual numeric(5,2) not null default 5.00,
  add column if not exists mp_access_token text,
  add column if not exists mp_refresh_token text,
  add column if not exists mp_public_key text,
  add column if not exists mp_user_id text,
  add column if not exists mp_token_expires_at timestamptz,
  add column if not exists mp_connected_at timestamptz,
  add column if not exists mp_scope text,
  add column if not exists mp_live_mode boolean not null default false;

-- Opcional, mas recomendado para congelar o valor que o atleta viu no ato da inscricao.
alter table public.inscricoes
  add column if not exists valor_inscricao numeric(10,2),
  add column if not exists valor_total numeric(10,2),
  add column if not exists mp_payment_id text,
  add column if not exists mp_preference_id text;