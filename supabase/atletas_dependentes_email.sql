-- Dependente (criança) não tem login, e-mail nem telefone próprio.
-- Essas colunas eram NOT NULL por causa do cadastro de titular.
-- A view atletas_publico deve continuar sem e-mail, CPF e telefone.
begin;

alter table public.atletas alter column email drop not null;
alter table public.atletas alter column telefone drop not null;

-- Views não têm RLS: no Table Editor aparecem como UNRESTRICTED.
-- Isso é esperado. Ela só expõe dados de ranking/chave (sem CPF, telefone, e-mail).
create or replace view public.atletas_publico
with (security_invoker = false) as
select
  id, user_id, nome, foto_url, equipe, academia, professor, professor_id,
  faixa, peso, sexo, nascimento, cidade, modalidade, role,
  ouro, prata, bronze, vitorias, derrotas, vitorias_wo, participacoes, created_at
from public.atletas;

grant select on public.atletas_publico to anon, authenticated;
revoke insert, update, delete on public.atletas_publico from anon, authenticated, public;

notify pgrst, 'reload schema';
commit;
