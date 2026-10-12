-- iTatame: instalação das proteções do chaveamento.
-- Execute o arquivo inteiro no SQL Editor do projeto iTatame.
-- Apenas define funções. Não chama geração de chaves nem altera dados existentes.
begin;
-- Substitui só peso ou só absoluto. Nunca apaga o outro chaveamento.
create or replace function public.substituir_chaves_evento(p_evento uuid,p_tipo text,p_lutas jsonb,p_organizador uuid) returns integer
language plpgsql security definer set search_path=public as $$
declare total integer;
begin
  perform 1 from public.eventos where id=p_evento and organizador_id=p_organizador for update;
  if not found then raise exception 'Evento não autorizado.'; end if;
  if p_tipo not in ('peso','absoluto') or jsonb_array_length(p_lutas)=0 then raise exception 'Chaveamento vazio ou inválido.'; end if;
  perform 1 from public.chaves where evento_id=p_evento for update;
  if exists(
    select 1 from public.chaves
    where evento_id=p_evento
      and ((p_tipo='absoluto' and categoria ilike '%Absoluto%') or (p_tipo='peso' and categoria not ilike '%Absoluto%'))
      and (status_luta in ('em_andamento','concluida') or vencedor is not null or iniciada_em is not null)
  ) then
    raise exception 'Evento com lutas iniciadas ou resultados. O chaveamento foi preservado.';
  end if;
  if exists(select 1 from jsonb_array_elements(p_lutas) x where x->>'evento_id' is distinct from p_evento::text) then raise exception 'Evento divergente.'; end if;
  delete from public.chaves
  where evento_id=p_evento
    and ((p_tipo='absoluto' and categoria ilike '%Absoluto%') or (p_tipo='peso' and categoria not ilike '%Absoluto%'));
  insert into public.chaves(evento_id,categoria,faixa,categoria_id,tempo_minutos,id_visual,atleta_1,equipe_1,numero_1,atleta_1_id,atleta_2,equipe_2,numero_2,atleta_2_id,fase,ordem,lado,proxima_luta,status_luta,pontuacao_atleta_1,pontuacao_atleta_2)
  select evento_id,categoria,faixa,categoria_id,tempo_minutos,id_visual,atleta_1,equipe_1,numero_1,atleta_1_id,atleta_2,equipe_2,numero_2,atleta_2_id,fase,ordem,lado,proxima_luta,'agendada',pontuacao_atleta_1,pontuacao_atleta_2
  from jsonb_populate_recordset(null::public.chaves,p_lutas);
  get diagnostics total=row_count;
  return total;
end $$;
revoke all on function public.substituir_chaves_evento(uuid,text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.substituir_chaves_evento(uuid,text,jsonb,uuid) to service_role;

-- Instala uma função; não executa a geração nem altera cadastros/pagamentos.
-- Depende de substituir_chaves_evento (blindar_chaves.sql).
-- O bloqueio do evento serializa peso, absoluto e chamadas concorrentes.
create or replace function public.criar_chaves_evento_automaticas(
  p_evento uuid, p_tipo text, p_lutas jsonb, p_organizador uuid
) returns integer
language plpgsql security definer set search_path=public as $$
declare e public.eventos;
begin
  select * into e from public.eventos
    where id=p_evento and organizador_id=p_organizador for update;
  if not found then raise exception 'Evento não autorizado.'; end if;
  if p_tipo not in ('peso','absoluto') or p_lutas is null
    or jsonb_typeof(p_lutas)<>'array' or jsonb_array_length(p_lutas)=0
  then raise exception 'Chaveamento vazio ou inválido.'; end if;
  if coalesce(e.data_fim_inscricoes,e.lote3_data_fim,e.lote2_data_fim,e.lote1_data_fim) is null
    or e.data_fim_checagem is null or e.data_divulgacao_chaves is null
    or now()<coalesce(e.data_fim_inscricoes,e.lote3_data_fim,e.lote2_data_fim,e.lote1_data_fim)
    or now()<e.data_fim_checagem or now()<e.data_divulgacao_chaves
  then raise exception 'Aguarde o encerramento da checagem e a divulgação das chaves.'; end if;
  -- A segunda chamada, após esperar o bloqueio, preserva as chaves da primeira.
  if exists(select 1 from public.chaves where evento_id=p_evento
    and ((p_tipo='absoluto' and categoria ilike '%Absoluto%')
      or (p_tipo='peso' and categoria not ilike '%Absoluto%')))
  then return 0; end if;
  return public.substituir_chaves_evento(p_evento,p_tipo,p_lutas,p_organizador);
end $$;
revoke all on function public.criar_chaves_evento_automaticas(uuid,text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.criar_chaves_evento_automaticas(uuid,text,jsonb,uuid) to service_role;
notify pgrst, 'reload schema';

commit;
select p.proname as funcao_instalada from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('substituir_chaves_evento','criar_chaves_evento_automaticas') and pg_get_function_identity_arguments(p.oid)='p_evento uuid, p_tipo text, p_lutas jsonb, p_organizador uuid' order by p.proname;
