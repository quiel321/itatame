-- Instala a função; não transfere nenhuma luta durante a instalação.
begin;
create or replace function public.transferir_luta_tatame(p_luta uuid,p_origem text,p_destino text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare l public.chaves; ev uuid; destino text; posicao integer;
begin
 select evento_id into ev from public.chaves where id=p_luta;
 if ev is null or not public.recepcao_autorizar(ev,array['mesario']) then raise exception 'Posto sem autorização para transferir esta luta.'; end if;
 -- Mesma ordem de bloqueio da recepção e do planejamento. Serializa transferências.
 perform 1 from public.eventos where id=ev for update;
 perform 1 from public.categorias_evento where evento_id=ev order by id for update;
 select * into l from public.chaves where id=p_luta for update;
 if l.tatame is distinct from p_origem then raise exception 'A luta mudou de área. Atualize a fila.'; end if;
 if l.status_luta is distinct from 'agendada' or l.vencedor is not null or l.finalizada_em is not null then
  raise exception 'Luta iniciada, pausada ou encerrada não pode ser transferida.';
 end if;
 if public.tatame_operacao_nome(p_destino)=public.tatame_operacao_nome(l.tatame) then raise exception 'Escolha outro tatame.'; end if;
 select s.identificacao into destino from public.staff_eventos s where s.evento_id=ev and s.funcao='mesario'
 and public.tatame_operacao_nome(s.identificacao)=public.tatame_operacao_nome(p_destino) order by s.id limit 1;
 if destino is null then raise exception 'O destino precisa ter um posto de mesário configurado.'; end if;
 select coalesce(max(ordem_tatame),0)+1 into posicao from public.chaves where evento_id=ev
 and public.tatame_operacao_nome(tatame)=public.tatame_operacao_nome(destino);
 -- Mantém ID, participantes, presença, chamadas, liberação, pontuação e chave.
 update public.chaves set tatame=destino,ordem_tatame=posicao,horario_estimado=null where id=l.id;
 return jsonb_build_object('id',l.id,'origem',l.tatame,'destino',destino,'ordem',posicao);
end $$;
revoke all on function public.transferir_luta_tatame(uuid,text,text) from public,anon;
grant execute on function public.transferir_luta_tatame(uuid,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
