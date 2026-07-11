-- iTatame Fotos - credenciais Mercado Pago para fotógrafos

alter table public.fotografos
  add column if not exists mp_access_token text,
  add column if not exists mp_refresh_token text,
  add column if not exists mp_public_key text,
  add column if not exists mp_user_id text,
  add column if not exists mp_token_expires_at timestamptz,
  add column if not exists mp_connected_at timestamptz,
  add column if not exists mp_scope text,
  add column if not exists mp_live_mode boolean not null default false;

create index if not exists idx_fotografos_mp_user_id on public.fotografos(mp_user_id);
