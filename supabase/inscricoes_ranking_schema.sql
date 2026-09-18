-- Compatibilidade da inscrição e do ranking. Aditivo: não apaga dados.
-- cpf em inscricoes desbloqueia o app em produção que ainda envia o campo;
-- a fonte de verdade continua em atletas.cpf.
-- lutas em atletas/atletas_publico é o que o ranking publica e exibe.
begin;

alter table public.inscricoes add column if not exists cpf text;

alter table public.atletas add column if not exists lutas integer not null default 0;

update public.atletas
set lutas = greatest(coalesce(lutas, 0), coalesce(vitorias, 0) + coalesce(derrotas, 0))
where coalesce(vitorias, 0) + coalesce(derrotas, 0) > coalesce(lutas, 0);

create or replace view public.atletas_publico
with (security_invoker = false) as
select
  id, user_id, nome, foto_url, equipe, academia, professor, professor_id,
  faixa, peso, sexo, nascimento, cidade, modalidade, role,
  ouro, prata, bronze, vitorias, derrotas, vitorias_wo, participacoes, created_at, lutas
from public.atletas;

grant select on public.atletas_publico to anon, authenticated;
revoke insert, update, delete on public.atletas_publico from anon, authenticated, public;

notify pgrst, 'reload schema';
commit;
