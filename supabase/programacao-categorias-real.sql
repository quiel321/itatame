-- Instalação autorizada para o iTatame real. Não executar planejamento ou limpeza.
-- Confrontos, inscrições, pagamentos, PINs, presenças e horários existentes preservados.
begin;
set local lock_timeout = '10s';
set local statement_timeout = '120s';
-- O editor gerenciado pode iniciar a transação antes do script.
-- Bloqueia DML durante a comparação, sem depender do nível de isolamento.
do $$ declare t record; begin
  for t in select tablename from pg_tables where schemaname='public' order by tablename loop
    execute format('lock table public.%I in share mode',t.tablename);
  end loop;
end $$;
do $$ begin
  if to_regprocedure('public.salvar_planejamento_tatames(uuid,jsonb)') is null
    or to_regprocedure('public.proteger_categoria_utilizada()') is null
    then raise exception 'Dependências do planejamento real ausentes.'; end if;
end $$;
create temporary table preservacao_programacao_real(tabela text primary key, quantidade bigint, antes text, depois text) on commit drop;
alter table preservacao_programacao_real enable row level security;
do $$ declare t record; h text; n bigint; begin
  for t in select tablename from pg_tables where schemaname='public' order by tablename loop
    execute format('select count(*), md5(coalesce(string_agg((to_jsonb(r)-''inicio_lutas_previsto'')::text,''|'' order by (to_jsonb(r)-''inicio_lutas_previsto'')::text),'''')) from public.%I r',t.tablename) into n,h;
    insert into preservacao_programacao_real values(t.tablename,n,h,null);
  end loop;
end $$;
-- Produção. Novo metadado opcional, inicialmente nulo. Não configura horários.
alter table public.categorias_evento add column if not exists inicio_lutas_previsto timestamptz;

create or replace function public.salvar_programacao_categorias(p_evento uuid, p_lutas jsonb, p_categorias jsonb)
returns integer language plpgsql security definer set search_path=public as $$
declare total integer;
begin
  perform 1 from public.eventos where id=p_evento and organizador_id=auth.uid() for update;
  if not found then raise exception 'Somente o organizador deste evento pode salvar a programação.'; end if;
  if p_lutas is null or jsonb_typeof(p_lutas)<>'array' or p_categorias is null or jsonb_typeof(p_categorias)<>'array'
    then raise exception 'Programação inválida.'; end if;
  perform 1 from public.chaves where evento_id=p_evento for update;
  perform 1 from public.categorias_evento where evento_id=p_evento for update;
  if exists(select 1 from jsonb_array_elements(p_categorias) x
    where not (x ?& array['categoria_id','inicio_previsto','inicio_anterior'])
      or not exists(select 1 from public.categorias_evento c where c.evento_id=p_evento and c.id::text=x->>'categoria_id'))
    or (select count(*) from jsonb_array_elements(p_categorias))<>(select count(distinct x->>'categoria_id') from jsonb_array_elements(p_categorias) x)
    then raise exception 'Há categorias inválidas ou de outro campeonato.'; end if;
  if exists(select 1 from jsonb_array_elements(p_categorias) x join public.categorias_evento c on c.id::text=x->>'categoria_id'
    where c.inicio_lutas_previsto is distinct from (x->>'inicio_anterior')::timestamptz)
    then raise exception 'Os horários mudaram em outra tela. Atualize antes de salvar.'; end if;
  if exists(select 1 from public.chaves c where c.evento_id=p_evento
    and (c.iniciada_em is not null or c.status_luta='em_andamento'
      or ((c.status_luta='concluida' or c.vencedor is not null)
        and upper(trim(coalesce(c.atleta_1,''))) not in ('','BYE','TBD')
        and upper(trim(coalesce(c.atleta_2,''))) not in ('','BYE','TBD')))
    and exists(select 1 from public.chaves alvo where alvo.evento_id=p_evento
      and exists(select 1 from jsonb_array_elements(p_categorias) x where alvo.categoria_id::text=x->>'categoria_id')
      and (c.categoria_id=alvo.categoria_id or upper(trim(c.tatame))=upper(trim(alvo.tatame)))))
    then raise exception 'Este tatame já iniciou a operação. Programação preservada.'; end if;
  -- Reutiliza as proteções de concorrência, sequência e operação já existentes.
  total := public.salvar_planejamento_tatames(p_evento,p_lutas);
  update public.categorias_evento c set inicio_lutas_previsto=(x->>'inicio_previsto')::timestamptz
    from jsonb_array_elements(p_categorias) x where c.evento_id=p_evento and c.id::text=x->>'categoria_id';
  return total;
end $$;
revoke all on function public.salvar_programacao_categorias(uuid,jsonb,jsonb) from public,anon;
grant execute on function public.salvar_programacao_categorias(uuid,jsonb,jsonb) to authenticated;


-- Compatibiliza somente o horário de início com a proteção de categorias em uso.
-- Preserva integralmente a lógica anterior para os demais campos e exclusões.
do $instalar$
declare definicao text; acrescimo text;
begin
  select pg_get_functiondef('public.proteger_categoria_utilizada()'::regprocedure) into definicao;
  if position('programacao_inicio_compativel_v1' in definicao)>0 then return; end if;
  acrescimo := $corpo$BEGIN
  -- programacao_inicio_compativel_v1: somente metadado de planejamento.
  if tg_op='UPDATE' then
    if (to_jsonb(new)-'inicio_lutas_previsto')=(to_jsonb(old)-'inicio_lutas_previsto') then
      if new.inicio_lutas_previsto is not distinct from old.inicio_lutas_previsto then return new; end if;
      if current_user not in ('postgres','supabase_admin') and not exists(
        select 1 from public.eventos where id=old.evento_id and organizador_id=auth.uid()
      ) then raise exception 'Somente o organizador pode ajustar o início previsto.'; end if;
      if exists(select 1 from public.chaves c where c.evento_id=old.evento_id
        and (c.categoria_id=old.id or exists(select 1 from public.chaves a where a.evento_id=old.evento_id
          and a.categoria_id=old.id and upper(trim(a.tatame))=upper(trim(c.tatame))))
        and (c.iniciada_em is not null or c.status_luta='em_andamento'
          or ((c.status_luta='concluida' or c.vencedor is not null)
            and upper(trim(coalesce(c.atleta_1,''))) not in ('','BYE','TBD')
            and upper(trim(coalesce(c.atleta_2,''))) not in ('','BYE','TBD')
            and upper(c.atleta_1) not like '%SEM OPONENTE%' and upper(c.atleta_2) not like '%SEM OPONENTE%')))
        then raise exception 'Este tatame já iniciou a operação. Programação preservada.'; end if;
      return new;
    end if;
  end if;
$corpo$;
  if definicao !~* '\mBEGIN\M' then raise exception 'Proteção original não reconhecida. Nenhuma alteração aplicada.'; end if;
  execute regexp_replace(definicao,'\mBEGIN\M',acrescimo,'i');
end $instalar$;


-- Afeta apenas o padrão de novas inserções. Não regrava tatames existentes.
alter table public.chaves alter column tatame drop default;
do $$ declare t record; h text; n bigint; begin
  for t in select * from preservacao_programacao_real order by tabela loop
    execute format('select count(*), md5(coalesce(string_agg((to_jsonb(r)-''inicio_lutas_previsto'')::text,''|'' order by (to_jsonb(r)-''inicio_lutas_previsto'')::text),'''')) from public.%I r',t.tabela) into n,h;
    if n is distinct from t.quantidade or h is distinct from t.antes then
      raise exception 'Dados alterados em %. Instalação revertida.',t.tabela;
    end if;
    update preservacao_programacao_real set depois=h where tabela=t.tabela;
  end loop;
end $$;
notify pgrst,'reload schema';
select count(*)::integer as tabelas_conferidas, bool_and(antes=depois) as dados_preservados,
  to_regprocedure('public.salvar_programacao_categorias(uuid,jsonb,jsonb)') is not null as programacao_instalada,
  (select column_default is null from information_schema.columns where table_schema='public' and table_name='chaves' and column_name='tatame') as novas_lutas_sem_tatame_padrao
from preservacao_programacao_real;
commit;
