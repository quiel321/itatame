-- Parte 1. Executar uma vez no SQL Editor ANTES do deploy do código que lê atletas_publico.
-- Cria a view sem CPF/telefone/e-mail e as funções de duplicidade.
-- As policies públicas de SELECT em atletas só caem na parte 2.
begin;

create or replace view public.atletas_publico
with (security_invoker = false) as
select
  id, user_id, nome, foto_url, equipe, academia, professor, professor_id,
  faixa, peso, sexo, nascimento, cidade, modalidade, role,
  ouro, prata, bronze, vitorias, derrotas, vitorias_wo, participacoes, created_at, lutas
from public.atletas;

grant select on public.atletas_publico to anon, authenticated;
revoke insert, update, delete on public.atletas_publico from anon, authenticated, public;

create or replace function public.documento_em_uso(p_cpf text, p_telefone text, p_exceto_user_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cpf_digits text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  cpf_fmt text;
  tel_digits text := regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g');
  cpf_hit boolean := false;
  tel_hit boolean := false;
begin
  if length(cpf_digits) = 11 then
    cpf_fmt := substr(cpf_digits,1,3)||'.'||substr(cpf_digits,4,3)||'.'||substr(cpf_digits,7,3)||'-'||substr(cpf_digits,10,2);
    cpf_hit := exists(
      select 1 from public.atletas a
      where a.user_id is distinct from p_exceto_user_id
        and a.cpf in (cpf_digits, cpf_fmt)
    );
  end if;
  if length(tel_digits) between 10 and 11 then
    tel_hit := exists(
      select 1 from public.atletas a
      where a.user_id is distinct from p_exceto_user_id
        and regexp_replace(coalesce(a.telefone, ''), '\D', '', 'g') = tel_digits
    );
  end if;
  return jsonb_build_object('cpf', cpf_hit, 'telefone', tel_hit);
end
$$;
revoke all on function public.documento_em_uso(text, text, text) from public, anon;
grant execute on function public.documento_em_uso(text, text, text) to authenticated;

create or replace function public.cpf_inscrito_no_evento(p_evento_id uuid, p_cpf text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  cpf_digits text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  cpf_fmt text;
begin
  if p_evento_id is null or length(cpf_digits) <> 11 then
    return false;
  end if;
  cpf_fmt := substr(cpf_digits,1,3)||'.'||substr(cpf_digits,4,3)||'.'||substr(cpf_digits,7,3)||'-'||substr(cpf_digits,10,2);
  return exists(
    select 1
    from public.atletas a
    join public.inscricoes i on i.atleta_id = a.id
    where i.evento_id = p_evento_id
      and a.cpf in (cpf_digits, cpf_fmt)
  );
end
$$;
revoke all on function public.cpf_inscrito_no_evento(uuid, text) from public, anon;
grant execute on function public.cpf_inscrito_no_evento(uuid, text) to authenticated;

notify pgrst, 'reload schema';
commit;
