-- Instala somente uma função. Não executa alterações nas chaves existentes.
-- Salva distribuição, sequência e horários juntos, ou desfaz tudo em caso de erro.
begin;
create or replace function public.salvar_planejamento_tatames(p_evento uuid, p_lutas jsonb)
returns integer language plpgsql security definer set search_path=public as $$
declare total integer;
begin
  perform 1 from public.eventos where id=p_evento and organizador_id=auth.uid() for update;
  if not found then raise exception 'Somente o organizador deste evento pode salvar o planejamento.'; end if;
  if p_lutas is null or jsonb_typeof(p_lutas)<>'array' then raise exception 'Planejamento inválido.'; end if;
  if jsonb_array_length(p_lutas)=0 then return 0; end if;
  perform 1 from public.chaves where evento_id=p_evento for update;
  if exists(select 1 from jsonb_array_elements(p_lutas) x
    where not (x ?& array['id','tatame','ordem_tatame','horario_estimado','tatame_anterior','ordem_anterior','horario_anterior'])
      or not exists(select 1 from public.chaves c where c.id::text=x->>'id' and c.evento_id=p_evento)
      or (nullif(x->>'tatame','') is not null and coalesce((x->>'ordem_tatame')::integer,0)<1))
    or (select count(*) from jsonb_array_elements(p_lutas))<>(select count(distinct x->>'id') from jsonb_array_elements(p_lutas) x)
  then raise exception 'Planejamento incompleto ou com lutas de outro evento.'; end if;
  if exists(select 1 from jsonb_array_elements(p_lutas) x join public.chaves c on c.id::text=x->>'id'
    where c.tatame is distinct from (x->>'tatame_anterior')
      or c.ordem_tatame is distinct from (x->>'ordem_anterior')::integer
      or c.horario_estimado is distinct from (x->>'horario_anterior')::timestamptz)
  then raise exception 'O planejamento mudou em outra tela. Atualize antes de salvar.'; end if;
  -- Inclui o tatame de origem e de destino. BYEs resolvidos automaticamente não
  -- bloqueiam a preparação; uma chamada ou luta real iniciada bloqueia.
  if exists(select 1 from public.chaves c where c.evento_id=p_evento
    and (c.iniciada_em is not null or c.status_luta='em_andamento'
      or ((c.status_luta='concluida' or c.vencedor is not null)
        and upper(trim(coalesce(c.atleta_1,''))) not in ('','BYE','TBD')
        and upper(trim(coalesce(c.atleta_2,''))) not in ('','BYE','TBD')
        and upper(c.atleta_1) not like '%SEM OPONENTE%' and upper(c.atleta_2) not like '%SEM OPONENTE%'))
    and exists(select 1 from jsonb_array_elements(p_lutas) x
      where upper(trim(coalesce(c.tatame,''))) in
        (upper(trim(coalesce(x->>'tatame',''))),upper(trim(coalesce(x->>'tatame_anterior',''))))))
  then raise exception 'Este tatame já tem chamadas ou lutas iniciadas. Planejamento preservado.'; end if;
  update public.chaves c set tatame=nullif(trim(x->>'tatame'),''),
    ordem_tatame=(x->>'ordem_tatame')::integer, horario_estimado=(x->>'horario_estimado')::timestamptz
    from jsonb_array_elements(p_lutas) x where c.evento_id=p_evento and c.id::text=x->>'id';
  get diagnostics total=row_count;
  -- Valida a fila resultante, inclusive as linhas não enviadas neste pedido.
  if exists(select 1 from public.chaves c where c.evento_id=p_evento and c.tatame is not null
    and c.ordem_tatame is not null and exists(select 1 from jsonb_array_elements(p_lutas) x
      where upper(trim(c.tatame))=upper(trim(x->>'tatame')))
    group by upper(trim(c.tatame)),c.ordem_tatame having count(*)>1)
  then raise exception 'Há posições repetidas na fila. Atualize o planejamento.'; end if;
  return total;
end $$;
revoke all on function public.salvar_planejamento_tatames(uuid,jsonb) from public,anon;
grant execute on function public.salvar_planejamento_tatames(uuid,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
