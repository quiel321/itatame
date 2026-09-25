-- Retratt - protege colunas sensiveis de public.fotografos
-- Execute depois de fotos_schema.sql e fotos_mercado_pago_columns.sql.
-- A policy fotografos_own_update permite que o proprio usuario edite a linha pelo
-- navegador. Esta trigger impede que, por esse caminho, ele altere o status
-- (ex.: sair de 'bloqueado'), o dono da linha ou as credenciais do Mercado Pago.
-- As rotas do servidor usam a service role e continuam livres para alterar.

create or replace function public.proteger_colunas_fotografo()
returns trigger
language plpgsql
as $$
declare
  papel text := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '');
begin
  if papel not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.status := 'pendente';
    new.mp_access_token := null;
    new.mp_refresh_token := null;
    new.mp_public_key := null;
    new.mp_user_id := null;
    new.mp_token_expires_at := null;
    new.mp_connected_at := null;
    new.mp_scope := null;
    new.mp_live_mode := false;
    return new;
  end if;

  if new.status is distinct from old.status
    or new.user_id is distinct from old.user_id
    or new.mp_access_token is distinct from old.mp_access_token
    or new.mp_refresh_token is distinct from old.mp_refresh_token
    or new.mp_public_key is distinct from old.mp_public_key
    or new.mp_user_id is distinct from old.mp_user_id
    or new.mp_token_expires_at is distinct from old.mp_token_expires_at
    or new.mp_connected_at is distinct from old.mp_connected_at
    or new.mp_scope is distinct from old.mp_scope
    or new.mp_live_mode is distinct from old.mp_live_mode
  then
    raise exception 'Alteracao nao permitida: status e credenciais do fotografo so podem ser alterados pelo servidor.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists proteger_colunas_fotografo on public.fotografos;
create trigger proteger_colunas_fotografo
  before insert or update on public.fotografos
  for each row execute function public.proteger_colunas_fotografo();
