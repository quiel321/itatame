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
