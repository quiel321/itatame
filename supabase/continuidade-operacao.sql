-- Instalação aditiva: não exclui nem recalcula inscrições, lutas ou medalhas existentes.
begin;
create table if not exists public.operacao_confirmacoes (
 id uuid primary key, evento_id uuid not null references public.eventos(id),
 posto_id uuid references public.staff_eventos(id), autor_id uuid not null,
 tipo text not null, alvo text not null, pedido jsonb not null, resposta jsonb not null,
 criada_em timestamptz not null default now()
);
alter table public.operacao_confirmacoes enable row level security;
revoke all on public.operacao_confirmacoes from public,anon,authenticated;
grant select on public.operacao_confirmacoes to service_role;

create or replace function public.operacao_pontos(p jsonb)
returns jsonb language sql immutable set search_path=public,pg_temp as $$
 select jsonb_build_object('pontos',coalesce((p->>'pontos')::integer,0),
 'vantagens',coalesce((p->>'vantagens')::integer,0),'punicoes',coalesce((p->>'punicoes')::integer,0));
$$;

create or replace function public.operacao_medalha(p_evento uuid,p_atleta bigint,p_coluna text,p_delta integer)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if p_atleta is null or p_delta=0 then return; end if;
 if p_coluna not in ('ouro','prata','bronze','vitorias_wo') or p_delta not in (-1,1)
 or not exists(select 1 from public.inscricoes where evento_id=p_evento and atleta_id=p_atleta and pagamento_ok and estorno_status is distinct from 'estornado') then raise exception 'Medalha fora da inscrição autorizada.'; end if;
 update public.atletas set
 ouro=case when p_coluna='ouro' then greatest(0,coalesce(ouro,0)+p_delta) else ouro end,
 prata=case when p_coluna='prata' then greatest(0,coalesce(prata,0)+p_delta) else prata end,
 bronze=case when p_coluna='bronze' then greatest(0,coalesce(bronze,0)+p_delta) else bronze end,
 vitorias_wo=case when p_coluna='vitorias_wo' then greatest(0,coalesce(vitorias_wo,0)+p_delta) else vitorias_wo end where id=p_atleta;
 if not found then raise exception 'Atleta da medalha não encontrado.'; end if;
end $$;
revoke all on function public.operacao_medalha(uuid,bigint,text,integer) from public,anon,authenticated;

-- Única entrada de gravação da versão nova. A confirmação e todos os efeitos
-- são gravados na mesma transação. Uma repetição devolve o recibo original.
create or replace function public.operacao_executar(p_id uuid,p_evento uuid,p_tipo text,p_alvo text,p_dados jsonb,p_base jsonb default '{}')
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
 posto public.staff_eventos; anterior public.operacao_confirmacoes; pedido jsonb;
 l public.chaves; destino public.chaves; i public.inscricoes; r jsonb; novo jsonb;
 cid uuid; v_lado integer; vencedor_id_n bigint; perdedor_id_n bigint;
 vencedor_n text; perdedor_n text; vencedor_eq text; perdedor_eq text;
 metodo text; baia text; lado_destino integer; corrigindo boolean;
 antigo_vencedor bigint; antigo_perdedor bigint; ignorar_antigo boolean; ignorar_novo boolean;
 eh_final boolean; eh_semi boolean; delta integer; v bigint; col text; a record;
 organizador boolean;
begin
 if auth.uid() is null or p_id is null or p_evento is null or p_alvo is null
 or p_dados is null or jsonb_typeof(p_dados)<>'object' or octet_length(p_dados::text)>16000
 then raise exception 'Operação inválida ou sessão ausente.'; end if;
 select st.* into posto from public.staff_sessoes ss join public.staff_eventos st on st.id=ss.staff_evento_id
 where ss.auth_user_id=auth.uid() and ss.evento_id=p_evento and st.evento_id=p_evento and ss.expira_em>now();
 organizador:=p_tipo='sumula' and exists(select 1 from public.eventos where id=p_evento and organizador_id=auth.uid());
 if p_tipo='sumula' and not organizador then raise exception 'Somente o organizador pode lançar a súmula.'; end if;
 if posto.id is null and not organizador then raise exception 'Posto sem autorização neste evento.'; end if;
 pedido:=jsonb_build_object('tipo',p_tipo,'alvo',p_alvo,'dados',p_dados,'base',coalesce(p_base,'{}'));
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 select * into anterior from public.operacao_confirmacoes where id=p_id;
 if found then
  if anterior.evento_id<>p_evento or anterior.posto_id is distinct from posto.id or anterior.pedido<>pedido or (posto.id is null and anterior.autor_id<>auth.uid())
  then raise exception 'Identificador de operação divergente.'; end if;
  return anterior.resposta || '{"repetida":true}'::jsonb;
 end if;
 -- Serializa reservas concorrentes de atletas/tatames entre categorias do evento.
 perform pg_advisory_xact_lock(hashtextextended('itatame-operacao:'||p_evento::text,0));
 if exists(select 1 from public.eventos where id=p_evento and status='ENCERRADO') then raise exception 'Evento encerrado. Nenhuma alteração aplicada.'; end if;

 if p_tipo='checkin' then
  if posto.funcao not in ('checkin','operacao') then raise exception 'Posto sem permissão de pesagem.'; end if;
  if not exists(select 1 from public.inscricoes where id=p_alvo::bigint and evento_id=p_evento) then raise exception 'Inscrição fora do evento.'; end if;
  perform public.recepcao_salvar_checkin(p_alvo::bigint,(p_dados->>'peso')::numeric,(p_dados->>'kimono')::boolean,p_dados->>'status',p_dados->>'estado_anterior');
  select * into i from public.inscricoes where id=p_alvo::bigint;
  r:=jsonb_build_object('inscricao',i.id,'status',i.status_checkin,'peso',i.peso_aferido);
 elsif p_tipo in ('recepcao','wo') then
  if p_tipo='recepcao' then
   if posto.funcao not in ('checkin','operacao') or coalesce(p_dados->>'acao','') not in ('chamar','ausente','retirar_ausencia','fechar') then raise exception 'Ação de recepção inválida.'; end if;
   if not exists(select 1 from public.categorias_evento where id=p_alvo::uuid and evento_id=p_evento) then raise exception 'Categoria fora do evento.'; end if;
   r:=public.recepcao_operar(p_alvo::uuid,p_dados->>'acao',(p_dados->>'inscricao')::bigint);
  else
   if posto.funcao not in ('chamador','operacao') then raise exception 'Posto sem permissão de chamada.'; end if;
   if not exists(select 1 from public.chaves where id=p_alvo::uuid and evento_id=p_evento) then raise exception 'Luta fora do evento.'; end if;
   r:=public.recepcao_wo_tatame(p_alvo::uuid,(p_dados->>'lado')::integer,p_dados->>'tatame');
  end if;
 else
  if p_tipo not in ('controle','chamar','iniciar','pontuacao','relogio','finalizar','corrigir','sumula') then raise exception 'Tipo de operação desconhecido.'; end if;
  select categoria_id into cid from public.chaves where id=p_alvo::uuid and evento_id=p_evento;
  if cid is null then raise exception 'Luta sem categoria válida neste evento.'; end if;
  -- Mesmo ordenamento de bloqueios da recepção: categoria, lutas e atletas.
  perform 1 from public.categorias_evento where id=cid and evento_id=p_evento for update;
  perform 1 from public.chaves where evento_id=p_evento and categoria_id=cid order by id for update;
  select * into l from public.chaves where id=p_alvo::uuid and evento_id=p_evento;
  if l.tatame is distinct from p_dados->>'tatame' then raise exception 'Conflito: a luta mudou de tatame. Confira a fila.'; end if;
  if p_tipo in ('controle','chamar') then
   if posto.funcao not in ('chamador','operacao') then raise exception 'Posto sem permissão de chamada.'; end if;
  else
   if not organizador and (posto.funcao is distinct from 'mesario' or upper(trim(posto.identificacao)) is distinct from upper(trim(l.tatame))) then raise exception 'Mesário fora deste tatame.'; end if;
  end if;
  if p_base ? 'atleta_1_id' and (p_base->'atleta_1_id' is distinct from to_jsonb(l)->'atleta_1_id' or p_base->'atleta_2_id' is distinct from to_jsonb(l)->'atleta_2_id') then raise exception 'Conflito: participantes alterados. Confira a luta.'; end if;
  if p_tipo<>'corrigir' and l.status_luta='concluida' then raise exception 'Conflito: esta luta já foi concluída. Confira o resultado.'; end if;
  if not exists(select 1 from public.recepcao_categorias where categoria_id=cid and fechada) then raise exception 'Categoria ainda não despachada.'; end if;
  -- Liberação pelo chamador obrigatória, mesmo sem chamador cadastrado no navegador.
  if p_tipo in ('iniciar','pontuacao','relogio','finalizar') and l.status_luta<>'em_andamento'
   and not exists(select 1 from public.operacao_confirmacoes ok
    where ok.evento_id=p_evento and ok.alvo=l.id::text and ok.tipo='chamar'
     and ok.pedido->'base'->>'atleta_1_id'=l.atleta_1_id::text
     and ok.pedido->'base'->>'atleta_2_id'=l.atleta_2_id::text)
  then raise exception 'Conflito: aguarde a liberação desta luta pelo chamador.'; end if;
  if p_tipo in ('chamar','iniciar') or (p_tipo='relogio' and (p_dados->>'rodando')::boolean)
   or (p_tipo='controle' and p_dados->>'acao'='presenca' and (p_dados->>'presente')::boolean) then
   if exists(select 1 from public.chaves c where c.evento_id=p_evento and c.id<>l.id and c.status_luta<>'concluida'
    and (c.status_luta='em_andamento' or c.iniciada_em is not null or coalesce((c.pontuacao_atleta_1->>'chamador_presente')::boolean,false) or coalesce((c.pontuacao_atleta_2->>'chamador_presente')::boolean,false))
    and (c.atleta_1_id in(l.atleta_1_id,l.atleta_2_id) or c.atleta_2_id in(l.atleta_1_id,l.atleta_2_id))) then raise exception 'Atleta já reservado em outro confronto. Confira a chamada.'; end if;
   -- A liberação entra na fila, mesmo com outro combate no tatame.
   -- Somente iniciar/retomar ocupa a área; agendadas liberadas continuam na fila.
   if (p_tipo='iniciar' or (p_tipo='relogio' and (p_dados->>'rodando')::boolean))
    and exists(select 1 from public.chaves c where c.evento_id=p_evento and c.id<>l.id and c.tatame=l.tatame and c.status_luta='em_andamento')
   then raise exception 'Conflito: tatame já ocupado por outro confronto.'; end if;
  end if;

  if p_tipo in ('pontuacao','controle') then
   v_lado:=(p_dados->>'lado')::integer;
   if v_lado is null or v_lado not in (1,2) then raise exception 'Lado inválido.'; end if;
   novo:=case v_lado when 1 then coalesce(l.pontuacao_atleta_1,'{}') else coalesce(l.pontuacao_atleta_2,'{}') end;
   if p_tipo='pontuacao' then
    if public.operacao_pontos(novo) is distinct from public.operacao_pontos(p_base->'pontuacao') then raise exception 'Conflito: pontuação alterada por outro operador. Confira antes de salvar.'; end if;
    for col in select unnest(array['pontos','vantagens','punicoes']) loop
    if jsonb_typeof(p_dados->'pontuacao'->col) is distinct from 'number' or (p_dados->'pontuacao'->>col)::numeric not between 0 and 999 or (p_dados->'pontuacao'->>col)::numeric<>trunc((p_dados->'pontuacao'->>col)::numeric) then raise exception 'Pontuação inválida.'; end if;
    end loop;
    novo:=novo || public.operacao_pontos(p_dados->'pontuacao');
   else
    if l.status_luta<>'agendada' or l.iniciada_em is not null then raise exception 'Conflito: confronto já liberado.'; end if;
    if coalesce(novo->'chamador_presente','false') is distinct from coalesce(p_base->'presente','false') or coalesce(novo->'chamador_chamadas','0') is distinct from coalesce(p_base->'chamadas','0') then raise exception 'Conflito: chamada alterada. Confira a fila.'; end if;
    if p_dados->>'acao'='presenca' then novo:=novo||jsonb_build_object('chamador_presente',(p_dados->>'presente')::boolean);
    elsif p_dados->>'acao'='chamada' then novo:=novo||jsonb_build_object('chamador_chamadas',least(3,coalesce((novo->>'chamador_chamadas')::integer,0)+1));
    else raise exception 'Controle inválido.'; end if;
   end if;
   if v_lado=1 then update public.chaves set pontuacao_atleta_1=novo where id=l.id;
   else update public.chaves set pontuacao_atleta_2=novo where id=l.id; end if;

  elsif p_tipo in ('chamar','iniciar','relogio') then
   if p_base->>'status_luta' is distinct from l.status_luta::text or coalesce(p_base->'iniciada_em','null') is distinct from coalesce(to_jsonb(l)->'iniciada_em','null') or (p_base ? 'duracao_segundos' and p_base->'duracao_segundos' is distinct from to_jsonb(l)->'duracao_segundos') then raise exception 'Conflito: cronômetro ou chamada alterados. Confira a luta.'; end if;
   if p_tipo='chamar' then
    if l.iniciada_em is not null or l.status_luta<>'agendada' or not coalesce((l.pontuacao_atleta_1->>'chamador_presente')::boolean,false) or not coalesce((l.pontuacao_atleta_2->>'chamador_presente')::boolean,false) then raise exception 'Confirme a presença dos dois atletas antes da chamada.'; end if;
    update public.chaves set iniciada_em=now() where id=l.id;
   elsif p_tipo='iniciar' then
    update public.chaves set status_luta='em_andamento',iniciada_em=now() where id=l.id;
   else
    if p_dados->>'segundos' is null or p_dados->>'rodando' is null or (p_dados->>'segundos')::integer not between 0 and 86400 then raise exception 'Tempo inválido.'; end if;
    if (p_dados->>'rodando')::boolean and (p_dados->>'segundos')::integer=0 then raise exception 'Tempo esgotado. Confira e registre o resultado.'; end if;
    update public.chaves set duracao_segundos=(p_dados->>'segundos')::integer,
     status_luta=case when (p_dados->>'rodando')::boolean then 'em_andamento'::public.status_luta_tipo else status_luta end,
     iniciada_em=case when (p_dados->>'rodando')::boolean then now() when l.status_luta='em_andamento' then null else iniciada_em end where id=l.id;
   end if;

  else
   corrigindo:=p_tipo='corrigir';
   if corrigindo and (l.status_luta<>'concluida' or p_base->'vencedor_id' is distinct from to_jsonb(l)->'vencedor_id' or p_base->'metodo_vitoria' is distinct from to_jsonb(l)->'metodo_vitoria') then raise exception 'Conflito: resultado alterado. Atualize antes de corrigir.'; end if;
   v_lado:=(p_dados->>'lado')::integer; metodo:=p_dados->>'metodo';
   if p_tipo='sumula' then
    if length(trim(coalesce(p_dados->>'motivo','')))<5 or length(p_dados->>'motivo')>1000 then raise exception 'Informe a referência da súmula e a justificativa.'; end if;
    if l.status_luta='em_andamento' and coalesce((p_dados->>'contingencia')::boolean,false) is not true then raise exception 'Confirme o encerramento no papel durante a contingência.'; end if;
    if exists(select 1 from public.chaves c where c.evento_id=p_evento and c.categoria_id=cid and c.faixa is not distinct from l.faixa and c.id<>l.id and
     (c.proxima_luta::text=l.id_visual or ((c.fase ilike '%CHAVE DE 3%' or c.fase ilike '%CHAVE DE 6%') and ((l.id_visual='2' and c.id_visual='1') or (l.id_visual='4' and c.id_visual='3')))) and c.status_luta<>'concluida') then raise exception 'Registre primeiro as lutas anteriores desta chave.'; end if;
    if metodo not in ('pontos','vantagens','finalizacao','decisao','desclassificacao','wo') or metodo is null then raise exception 'Método da súmula inválido.'; end if;
    metodo:=case when metodo='decisao' then 'decisao_arbitro' when metodo in ('vantagens','desclassificacao') then 'pontos' else metodo end;
   end if;
   if v_lado is null or v_lado not in (1,2) or metodo is null or metodo not in ('pontos','finalizacao','wo','decisao_arbitro','desclassificacao') then raise exception 'Resultado inválido.'; end if;
   vencedor_id_n:=case v_lado when 1 then l.atleta_1_id else l.atleta_2_id end;
   perdedor_id_n:=case v_lado when 1 then l.atleta_2_id else l.atleta_1_id end;
   vencedor_n:=case v_lado when 1 then l.atleta_1 else l.atleta_2 end;
   perdedor_n:=case v_lado when 1 then l.atleta_2 else l.atleta_1 end;
   vencedor_eq:=case v_lado when 1 then l.equipe_1 else l.equipe_2 end;
   perdedor_eq:=case v_lado when 1 then l.equipe_2 else l.equipe_1 end;
   if vencedor_id_n is null or upper(trim(coalesce(vencedor_n,''))) in ('','BYE','TBD') then raise exception 'Vencedor inválido.'; end if;
   if not corrigindo and (public.operacao_pontos(l.pontuacao_atleta_1) is distinct from public.operacao_pontos(p_base->'pontuacao_atleta_1') or public.operacao_pontos(l.pontuacao_atleta_2) is distinct from public.operacao_pontos(p_base->'pontuacao_atleta_2')) then raise exception 'Conflito: confira a pontuação antes de encerrar.'; end if;
   if p_tipo='sumula' then
    for col in select unnest(array['pontos','vantagens','punicoes']) loop
     if jsonb_typeof(p_dados->'placar1'->col) is distinct from 'number' or jsonb_typeof(p_dados->'placar2'->col) is distinct from 'number'
      or (p_dados->'placar1'->>col)::numeric not between 0 and 999 or (p_dados->'placar2'->>col)::numeric not between 0 and 999 then raise exception 'Confira os dois placares da súmula.'; end if;
    end loop;
    update public.chaves set pontuacao_atleta_1=coalesce(pontuacao_atleta_1,'{}')||public.operacao_pontos(p_dados->'placar1'),pontuacao_atleta_2=coalesce(pontuacao_atleta_2,'{}')||public.operacao_pontos(p_dados->'placar2') where id=l.id;
   end if;
   eh_final:=l.fase ilike 'final%' or l.id_visual='999';
   eh_semi:=l.proxima_luta=999 and not ((l.fase ilike '%CHAVE DE 3%' or l.fase ilike '%CHAVE DE 6%') and l.id_visual in ('1','3'));
   antigo_vencedor:=l.vencedor_id; antigo_perdedor:=case when l.vencedor_id=l.atleta_1_id then l.atleta_2_id else l.atleta_1_id end;
   ignorar_antigo:=l.metodo_vitoria::text='wo' and antigo_perdedor is not null;
   ignorar_novo:=metodo='wo' and perdedor_id_n is not null;

   -- Não muda participante de um destino que já começou. Falha reverte tudo.
   if l.proxima_luta is not null then
    select * into destino from public.chaves where evento_id=p_evento and categoria_id=cid and faixa is not distinct from l.faixa and id_visual=l.proxima_luta::text;
    if destino.id is null then raise exception 'Destino da chave não encontrado.'; end if;
    lado_destino:=case when coalesce(l.id_visual,l.ordem::text)::integer%2=1 then 1 else 2 end;
    if (destino.status_luta<>'agendada' or destino.iniciada_em is not null) and (case lado_destino when 1 then destino.atleta_1_id else destino.atleta_2_id end) is distinct from vencedor_id_n then raise exception 'Destino já operado. Correção precisa de revisão do organizador.'; end if;
    if lado_destino=1 then update public.chaves set atleta_1=vencedor_n,atleta_1_id=vencedor_id_n,equipe_1=vencedor_eq where id=destino.id;
    else update public.chaves set atleta_2=vencedor_n,atleta_2_id=vencedor_id_n,equipe_2=vencedor_eq where id=destino.id; end if;
   end if;
   baia:=case when (l.fase ilike '%CHAVE DE 3%' or l.fase ilike '%CHAVE DE 6%') and metodo<>'wo' then case l.id_visual when '1' then '2' when '3' then '4' end end;
   if baia is not null and perdedor_id_n is not null then
    select * into destino from public.chaves where evento_id=p_evento and categoria_id=cid and faixa is not distinct from l.faixa and id_visual=baia;
    if destino.id is null then raise exception 'Baia da chave não encontrada.'; end if;
    if (destino.status_luta<>'agendada' or destino.iniciada_em is not null) and destino.atleta_1_id is distinct from perdedor_id_n then raise exception 'Baia já operada. Correção precisa de revisão do organizador.'; end if;
    update public.chaves set atleta_1=perdedor_n,atleta_1_id=perdedor_id_n,equipe_1=perdedor_eq where id=destino.id;
   end if;
   -- Contadores existentes são preservados; apenas o delta desta operação entra.
   perform 1 from public.atletas where id in (vencedor_id_n,perdedor_id_n,antigo_vencedor,antigo_perdedor) order by id for update;
   for a in select * from (values
    (vencedor_id_n,'ouro',case when eh_final and not ignorar_novo then 1 else 0 end),
    (perdedor_id_n,'prata',case when eh_final and not ignorar_novo then 1 else 0 end),
    (perdedor_id_n,'bronze',case when eh_semi and not ignorar_novo then 1 else 0 end),
    (vencedor_id_n,'vitorias_wo',case when metodo='wo' and not ignorar_novo then 1 else 0 end),
    (antigo_vencedor,'ouro',case when corrigindo and eh_final and not ignorar_antigo then -1 else 0 end),
    (antigo_perdedor,'prata',case when corrigindo and eh_final and not ignorar_antigo then -1 else 0 end),
    (antigo_perdedor,'bronze',case when corrigindo and eh_semi and not ignorar_antigo then -1 else 0 end),
    (antigo_vencedor,'vitorias_wo',case when corrigindo and l.metodo_vitoria::text='wo' and not ignorar_antigo then -1 else 0 end)
   ) as d(atleta,coluna,incremento) where atleta is not null and incremento<>0 loop
    perform public.operacao_medalha(p_evento,a.atleta,a.coluna,a.incremento);
   end loop;
   novo:=jsonb_build_object('decisao_arbitro',metodo='decisao_arbitro');
   update public.chaves set vencedor=vencedor_n,vencedor_id=vencedor_id_n,status_luta='concluida',
    metodo_vitoria=(case when metodo='decisao_arbitro' then 'pontos' else metodo end)::public.metodo_vitoria_tipo,
    finalizada_em=case when corrigindo then finalizada_em else now() end,iniciada_em=null,
    pontuacao_atleta_1=coalesce(pontuacao_atleta_1,'{}')||jsonb_build_object('decisao_arbitro',metodo='decisao_arbitro' and v_lado=1),
    pontuacao_atleta_2=coalesce(pontuacao_atleta_2,'{}')||jsonb_build_object('decisao_arbitro',metodo='decisao_arbitro' and v_lado=2)
   where id=l.id;
   if p_tipo='sumula' then
    update public.chaves set pontuacao_atleta_1=pontuacao_atleta_1||jsonb_build_object('metodo_sumula',p_dados->>'metodo') where id=l.id;
    insert into public.resultados_manuais(luta_id,organizador_id,motivo,vencedor_id) values(l.id,auth.uid(),trim(p_dados->>'motivo'),vencedor_id_n);
   end if;
  end if;
  select to_jsonb(c) into novo from public.chaves c where id=l.id;
  r:=jsonb_build_object('luta',novo);
 end if;
 r:=coalesce(r,'{}')||jsonb_build_object('operacao_id',p_id,'confirmada',true);
 insert into public.operacao_confirmacoes(id,evento_id,posto_id,autor_id,tipo,alvo,pedido,resposta)
 values(p_id,p_evento,posto.id,auth.uid(),p_tipo,p_alvo,pedido,r);
 return r;
end $$;
revoke all on function public.operacao_pontos(jsonb) from public,anon;
revoke all on function public.operacao_executar(uuid,uuid,text,text,jsonb,jsonb) from public,anon;
grant execute on function public.operacao_executar(uuid,uuid,text,text,jsonb,jsonb) to authenticated;
-- Um único SELECT monta a edição consistente, sem limite de 1.000 linhas do REST.
create or replace function public.operacao_kit_offline(p_evento uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null or not exists(select 1 from public.eventos where id=p_evento and organizador_id=auth.uid()) then raise exception 'Somente o organizador pode gerar o kit deste evento.'; end if;
 return (select jsonb_build_object('evento',jsonb_build_object('id',e.id,'nome',e.nome,'estado',e.estado),
  'gerado_em',now(),
  'lutas',(select coalesce(jsonb_agg(to_jsonb(c) order by c.id),'[]') from public.chaves c where c.evento_id=e.id),
  'inscricoes',(select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'atleta_id',i.atleta_id,'atleta',i.atleta,'categoria_id',i.categoria_id,'categoria',i.categoria,'faixa',i.faixa,'equipe',i.equipe,'pagamento_ok',i.pagamento_ok,'status_checkin',i.status_checkin,'peso_aferido',i.peso_aferido,'pesagem_ok',i.pesagem_ok,'kimono_aprovado',i.kimono_aprovado) order by i.id),'[]') from public.inscricoes i where i.evento_id=e.id and i.estorno_status is distinct from 'estornado'),
  'categorias',(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'nome',c.nome,'tipo',c.tipo,'peso_min',c.peso_min,'peso_max',c.peso_max) order by c.id),'[]') from public.categorias_evento c where c.evento_id=e.id)) from public.eventos e where e.id=p_evento);
end $$;
revoke all on function public.operacao_kit_offline(uuid) from public,anon;
grant execute on function public.operacao_kit_offline(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
