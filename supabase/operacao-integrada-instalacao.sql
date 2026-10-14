-- Instalação aditiva. Executar no projeto iTatame sivdvcuggjswfcuzrvgs.
-- Não executa UPDATE/DELETE/INSERT em tabelas existentes; não gera chaves.
begin;
do $$ begin
 if exists(select 1 from public.chaves) then raise exception 'Há chaves geradas: interromper implantação e revisar preservação.'; end if;
 if not exists(select 1 from public.eventos where id='7885981f-90e7-41ad-86f2-2bd328a7088c') then raise exception 'Campeonato de produção não confirmado.'; end if;
end $$;
create temporary table integracao_hashes_antes on commit drop as select 'eventos' as tabela,count(*) as total,md5(coalesce(string_agg(md5(row_to_json(t)::text),'' order by t.id),'vazio')) as hash from public.eventos t where id='7885981f-90e7-41ad-86f2-2bd328a7088c'
union all select 'inscricoes',count(*),md5(coalesce(string_agg(md5(row_to_json(t)::text),'' order by t.id),'vazio')) from public.inscricoes t where evento_id='7885981f-90e7-41ad-86f2-2bd328a7088c'
union all select 'categorias_evento',count(*),md5(coalesce(string_agg(md5(row_to_json(t)::text),'' order by t.id),'vazio')) from public.categorias_evento t where evento_id='7885981f-90e7-41ad-86f2-2bd328a7088c'
union all select 'chaves',count(*),md5(coalesce(string_agg(md5(row_to_json(t)::text),'' order by t.id),'vazio')) from public.chaves t where evento_id='7885981f-90e7-41ad-86f2-2bd328a7088c'
union all select 'staff_eventos',count(*),md5(coalesce(string_agg(md5(row_to_json(t)::text),'' order by t.id),'vazio')) from public.staff_eventos t where evento_id='7885981f-90e7-41ad-86f2-2bd328a7088c'
union all select 'atletas',count(*),md5(coalesce(string_agg(md5(row_to_json(t)::text),'' order by t.id),'vazio')) from public.atletas t where id in(select atleta_id from public.inscricoes where evento_id='7885981f-90e7-41ad-86f2-2bd328a7088c');
-- Estrutura aditiva de produção. Não atualiza registros existentes na instalação.

create table if not exists public.recepcao_categorias (
 categoria_id uuid primary key references public.categorias_evento(id) on delete cascade,
 evento_id uuid not null references public.eventos(id) on delete cascade,
 fechada boolean not null default false,
 fechada_em timestamptz, fechada_por uuid,
 snapshot_chaves jsonb, atualizada_em timestamptz not null default now()
);
create table if not exists public.recepcao_inscricoes (
 inscricao_id bigint primary key references public.inscricoes(id) on delete cascade,
 categoria_id uuid not null references public.categorias_evento(id) on delete cascade,
 evento_id uuid not null references public.eventos(id) on delete cascade,
 chamadas integer not null default 0 check(chamadas between 0 and 3),
 ausente boolean not null default false, atualizada_em timestamptz not null default now(), operador uuid
);
alter table public.recepcao_categorias enable row level security;
alter table public.recepcao_inscricoes enable row level security;
revoke all on public.recepcao_categorias, public.recepcao_inscricoes from public,anon,authenticated;
grant select on public.recepcao_categorias, public.recepcao_inscricoes to authenticated;
grant all on public.recepcao_categorias, public.recepcao_inscricoes to service_role;
drop policy if exists recepcao_leitura_staff on public.recepcao_categorias;
create policy recepcao_leitura_staff on public.recepcao_categorias for select to authenticated using(evento_id=public.staff_sessao_evento() or exists(select 1 from public.eventos e where e.id=evento_id and e.organizador_id=auth.uid()));
drop policy if exists recepcao_leitura_staff on public.recepcao_inscricoes;
create policy recepcao_leitura_staff on public.recepcao_inscricoes for select to authenticated using(evento_id=public.staff_sessao_evento() or exists(select 1 from public.eventos e where e.id=evento_id and e.organizador_id=auth.uid()));

create or replace function public.recepcao_autorizar(p_evento uuid,p_funcoes text[])
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select auth.uid() is not null and exists(select 1 from public.eventos e where e.id=p_evento and (
 e.organizador_id=auth.uid() or exists(select 1 from public.staff_sessoes s join public.staff_eventos st on st.id=s.staff_evento_id and st.evento_id=s.evento_id
 where s.auth_user_id=auth.uid() and s.evento_id=e.id and s.expira_em>now() and st.funcao=any(p_funcoes))));
$$;
revoke all on function public.recepcao_autorizar(uuid,text[]) from public,anon;
grant execute on function public.recepcao_autorizar(uuid,text[]) to authenticated;

-- A política antiga de UPDATE autenticado continua limitada ao posto/organizador do evento.
drop policy if exists chaves_operacao_autorizada on public.chaves;
create policy chaves_operacao_autorizada on public.chaves as restrictive for update to authenticated
 using(public.recepcao_autorizar(evento_id,array['checkin','operacao','chamador','mesario']))
 with check(public.recepcao_autorizar(evento_id,array['checkin','operacao','chamador','mesario']));

-- Resolver somente vagas inelegíveis, mantendo nomes originais para histórico e W.O. operacional.
create or replace function public.recepcao_resolver_ausencias(p_categoria uuid)
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare ev uuid; l public.chaves; rodada integer; total integer:=0; mudou boolean;
 r1 boolean; r2 boolean; ok1 boolean; ok2 boolean; a1 boolean; a2 boolean;
 vencedor_nome text; vencedor_num bigint; vencedor_eq text; destino uuid; lado integer;
begin
 select evento_id into ev from public.categorias_evento where id=p_categoria for update;
 if not public.recepcao_autorizar(ev,array['checkin','operacao','chamador','mesario']) then raise exception 'Posto sem autorização nesta categoria.'; end if;
 if not exists(select 1 from public.recepcao_categorias where categoria_id=p_categoria and fechada) then return 0; end if;
 perform 1 from public.chaves where categoria_id=p_categoria and evento_id=ev order by id for update;
 -- Ausência posterior à pesagem: a primeira luta de três pode ter sido encerrada pelo chamador.
 update public.chaves baia set atleta_1='BYE',atleta_1_id=null,equipe_1='',
  pontuacao_atleta_1=coalesce(baia.pontuacao_atleta_1,'{}'::jsonb)||'{"recepcao_vaga_ausente":true}'::jsonb
 where baia.evento_id=ev and baia.categoria_id=p_categoria and baia.id_visual='2' and baia.atleta_1='TBD' and baia.status_luta='agendada'
 and exists(select 1 from public.chaves primeira where primeira.evento_id=ev and primeira.categoria_id=p_categoria and primeira.faixa is not distinct from baia.faixa and primeira.id_visual='1' and primeira.fase like '%Chave de 3%' and primeira.status_luta='concluida' and primeira.metodo_vitoria='wo' and primeira.atleta_1_id is not null and primeira.atleta_2_id is not null);
 for rodada in 1..20 loop
  mudou:=false;
  for l in select * from public.chaves where categoria_id=p_categoria and evento_id=ev and status_luta='agendada' and iniciada_em is null order by ordem,id_visual loop
   -- TBD é resultado ainda não propagado. Nunca representa ausência.
   if coalesce(l.atleta_1,'TBD')='TBD' or coalesce(l.atleta_2,'TBD')='TBD' then continue; end if;
   r1:=l.atleta_1_id is not null; r2:=l.atleta_2_id is not null;
   select exists(select 1 from public.inscricoes i left join public.recepcao_inscricoes ri on ri.inscricao_id=i.id
    where i.evento_id=ev and i.categoria_id=p_categoria and i.atleta_id=l.atleta_1_id and i.pagamento_ok and i.estorno_status is distinct from 'estornado' and i.status_checkin='aprovado' and i.pesagem_ok and i.kimono_aprovado and not coalesce(ri.ausente,false)) into ok1;
   select exists(select 1 from public.inscricoes i left join public.recepcao_inscricoes ri on ri.inscricao_id=i.id
    where i.evento_id=ev and i.categoria_id=p_categoria and i.atleta_id=l.atleta_2_id and i.pagamento_ok and i.estorno_status is distinct from 'estornado' and i.status_checkin='aprovado' and i.pesagem_ok and i.kimono_aprovado and not coalesce(ri.ausente,false)) into ok2;
   a1:=r1 and not ok1; a2:=r2 and not ok2;
   if ok1 and ok2 then continue; end if;
   -- Avanço estrutural BYE continua com o motor existente. Aqui tratamos ausências/reprovações.
   if not a1 and not a2 and not coalesce((l.pontuacao_atleta_1->>'recepcao_vaga_ausente')::boolean,false) and not coalesce((l.pontuacao_atleta_2->>'recepcao_vaga_ausente')::boolean,false) then continue; end if;
   vencedor_nome:=case when ok1 then l.atleta_1 when ok2 then l.atleta_2 else 'BYE' end;
   vencedor_num:=case when ok1 then l.atleta_1_id when ok2 then l.atleta_2_id else null end;
   vencedor_eq:=case when ok1 then l.equipe_1 when ok2 then l.equipe_2 else '' end;
   update public.chaves set status_luta='concluida',vencedor=vencedor_nome,vencedor_id=vencedor_num,metodo_vitoria='wo',finalizada_em=now(),
    pontuacao_atleta_1=coalesce(pontuacao_atleta_1,'{}'::jsonb)||'{"recepcao_wo":true}'::jsonb,
    pontuacao_atleta_2=coalesce(pontuacao_atleta_2,'{}'::jsonb)||'{"recepcao_wo":true}'::jsonb where id=l.id;
   if l.proxima_luta is not null then
    select id into destino from public.chaves where evento_id=ev and categoria_id=p_categoria and faixa is not distinct from l.faixa and id_visual=l.proxima_luta::text limit 1;
    lado:=case when l.id_visual::integer%2=1 then 1 else 2 end;
    if destino is null then raise exception 'Destino da chave não encontrado.'; end if;
    if exists(select 1 from public.chaves where id=destino and status_luta<>'agendada') then raise exception 'Próxima luta já foi operada; procure o organizador.'; end if;
    if lado=1 then update public.chaves set atleta_1=vencedor_nome,atleta_1_id=vencedor_num,equipe_1=vencedor_eq,
     pontuacao_atleta_1=coalesce(pontuacao_atleta_1,'{}'::jsonb)||jsonb_build_object('recepcao_vaga_ausente',vencedor_num is null) where id=destino;
    else update public.chaves set atleta_2=vencedor_nome,atleta_2_id=vencedor_num,equipe_2=vencedor_eq,
     pontuacao_atleta_2=coalesce(pontuacao_atleta_2,'{}'::jsonb)||jsonb_build_object('recepcao_vaga_ausente',vencedor_num is null) where id=destino; end if;
   end if;
   -- Na chave de três o perdedor ausente não volta à repescagem.
   if l.fase like '%Chave de 3%' and l.id_visual='1' then
    update public.chaves set atleta_1='BYE',atleta_1_id=null,equipe_1='',
     pontuacao_atleta_1=coalesce(pontuacao_atleta_1,'{}'::jsonb)||'{"recepcao_vaga_ausente":true}'::jsonb
     where evento_id=ev and categoria_id=p_categoria and faixa is not distinct from l.faixa and id_visual='2' and status_luta='agendada';
   end if;
   total:=total+1; mudou:=true;
  end loop;
  exit when not mudou;
 end loop;
 return total;
end $$;
revoke all on function public.recepcao_resolver_ausencias(uuid) from public,anon;
grant execute on function public.recepcao_resolver_ausencias(uuid) to authenticated;

create or replace function public.recepcao_operar(p_categoria uuid,p_acao text,p_inscricao bigint default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare ev uuid; i public.inscricoes; estado public.recepcao_categorias; item public.recepcao_inscricoes; n integer; registro jsonb; resolvidos integer;
begin
 select evento_id into ev from public.categorias_evento where id=p_categoria for update;
 if ev is null or not public.recepcao_autorizar(ev,array['checkin','operacao']) then raise exception 'Posto sem autorização nesta categoria.'; end if;
 if not exists(select 1 from public.eventos where id=ev and status<>'ENCERRADO') then raise exception 'Evento encerrado.'; end if;
 insert into public.recepcao_categorias(categoria_id,evento_id) values(p_categoria,ev) on conflict do nothing;
 select * into estado from public.recepcao_categorias where categoria_id=p_categoria for update;
 if p_acao='reabrir' then
  if not exists(select 1 from public.eventos where id=ev and organizador_id=auth.uid()) then raise exception 'Somente o organizador pode reabrir.'; end if;
  if not estado.fechada then return jsonb_build_object('fechada',false); end if;
  if exists(select 1 from public.chaves where evento_id=ev and categoria_id=p_categoria and (iniciada_em is not null or status_luta='em_andamento' or coalesce((pontuacao_atleta_1->>'chamador_presente')::boolean,false) or coalesce((pontuacao_atleta_2->>'chamador_presente')::boolean,false) or (status_luta='concluida' and metodo_vitoria<>'wo'))) then raise exception 'Categoria já despachada ou com combate realizado. Reabertura bloqueada.'; end if;
  if exists(select 1 from public.chaves where evento_id=ev and categoria_id=p_categoria and status_luta='concluida' and atleta_1_id is not null and atleta_2_id is not null and not coalesce((pontuacao_atleta_1->>'recepcao_wo')::boolean,false)) then raise exception 'Já houve decisão de ausência no tatame. Reabertura bloqueada.'; end if;
  update public.recepcao_categorias set fechada=false,fechada_em=null,fechada_por=null,atualizada_em=now() where categoria_id=p_categoria;
  for registro in select value from jsonb_array_elements(estado.snapshot_chaves) loop
   update public.chaves set atleta_1=registro->>'atleta_1',atleta_2=registro->>'atleta_2',atleta_1_id=(registro->>'atleta_1_id')::bigint,atleta_2_id=(registro->>'atleta_2_id')::bigint,equipe_1=registro->>'equipe_1',equipe_2=registro->>'equipe_2',
    status_luta=(registro->>'status_luta')::public.status_luta_tipo,vencedor=registro->>'vencedor',vencedor_id=(registro->>'vencedor_id')::bigint,metodo_vitoria=(registro->>'metodo_vitoria')::public.metodo_vitoria_tipo,
    iniciada_em=(registro->>'iniciada_em')::timestamptz,finalizada_em=(registro->>'finalizada_em')::timestamptz,pontuacao_atleta_1=registro->'pontuacao_atleta_1',pontuacao_atleta_2=registro->'pontuacao_atleta_2'
    where id=(registro->>'id')::uuid and evento_id=ev and categoria_id=p_categoria;
  end loop;
  return jsonb_build_object('fechada',false);
 end if;
 if p_acao='fechar' and estado.fechada then return jsonb_build_object('fechada',true,'ja_fechada',true); end if;
 if estado.fechada then raise exception 'Check-in fechado. Procure o organizador para reabrir.'; end if;
 if p_acao in ('chamar','ausente','retirar_ausencia') then
  select * into i from public.inscricoes where id=p_inscricao and evento_id=ev and categoria_id=p_categoria and pagamento_ok and estorno_status is distinct from 'estornado' for update;
  if i.id is null then raise exception 'Inscrição não habilitada nesta categoria.'; end if;
  insert into public.recepcao_inscricoes(inscricao_id,categoria_id,evento_id) values(i.id,p_categoria,ev) on conflict do nothing;
  select * into item from public.recepcao_inscricoes where inscricao_id=i.id for update;
  if p_acao='retirar_ausencia' then
   update public.recepcao_inscricoes set ausente=false,chamadas=0,operador=auth.uid(),atualizada_em=now() where inscricao_id=i.id;
   return jsonb_build_object('ausente',false,'chamadas',0);
  end if;
  if i.status_checkin<>'pendente' or item.ausente then raise exception 'Atleta já conferido ou declarado ausente.'; end if;
  if p_acao='chamar' then
   update public.recepcao_inscricoes set chamadas=least(3,chamadas+1),operador=auth.uid(),atualizada_em=now() where inscricao_id=i.id returning chamadas into n;
   return jsonb_build_object('chamadas',n,'ausente',false);
  end if;
  if item.chamadas<3 then raise exception 'Registre três chamadas antes de confirmar ausência.'; end if;
  update public.recepcao_inscricoes set ausente=true,operador=auth.uid(),atualizada_em=now() where inscricao_id=i.id;
  return jsonb_build_object('chamadas',3,'ausente',true);
 end if;
 if p_acao<>'fechar' then raise exception 'Ação desconhecida.'; end if;
 if not exists(select 1 from public.chaves where evento_id=ev and categoria_id=p_categoria) then raise exception 'Gere as chaves antes de fechar a categoria.'; end if;
 perform 1 from public.inscricoes where evento_id=ev and categoria_id=p_categoria order by id for update;
 if exists(select 1 from public.inscricoes pend left join public.recepcao_inscricoes ri on ri.inscricao_id=pend.id where pend.evento_id=ev and pend.categoria_id=p_categoria and pend.pagamento_ok and pend.estorno_status is distinct from 'estornado' and ((pend.status_checkin='pendente' and not coalesce(ri.ausente,false)) or (pend.status_checkin='aprovado' and (not coalesce(pend.pesagem_ok,false) or not coalesce(pend.kimono_aprovado,false))))) then raise exception 'Resolva todos os pendentes e confira pesagem e kimono antes de fechar.'; end if;
 perform 1 from public.chaves where evento_id=ev and categoria_id=p_categoria order by id for update;
 if exists(select 1 from public.chaves where evento_id=ev and categoria_id=p_categoria and (iniciada_em is not null or status_luta='em_andamento' or (status_luta='concluida' and metodo_vitoria<>'wo'))) then raise exception 'Já existe combate operado nesta categoria.'; end if;
 select jsonb_agg(to_jsonb(c)) into registro from public.chaves c where evento_id=ev and categoria_id=p_categoria;
 update public.recepcao_categorias set fechada=true,fechada_em=now(),fechada_por=auth.uid(),snapshot_chaves=registro,atualizada_em=now() where categoria_id=p_categoria;
 resolvidos:=public.recepcao_resolver_ausencias(p_categoria);
 return jsonb_build_object('fechada',true,'avancos_por_ausencia',resolvidos);
end $$;
revoke all on function public.recepcao_operar(uuid,text,bigint) from public,anon;
grant execute on function public.recepcao_operar(uuid,text,bigint) to authenticated;

-- Pesagem serializada com o fechamento: não existe aprovação posterior por uma tela desatualizada.
create or replace function public.recepcao_salvar_checkin(p_inscricao bigint,p_peso numeric,p_kimono boolean,p_status text,p_estado_anterior text default 'pendente')
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare i public.inscricoes; c public.categorias_evento;
begin
 select * into i from public.inscricoes where id=p_inscricao;
 select * into c from public.categorias_evento where id=i.categoria_id and evento_id=i.evento_id for update;
 if c.id is null or not public.recepcao_autorizar(i.evento_id,array['checkin','operacao']) then raise exception 'Posto sem autorização nesta inscrição.'; end if;
 if exists(select 1 from public.eventos e where e.id=i.evento_id and (coalesce(e.data_fim_inscricoes,e.lote3_data_fim,e.lote2_data_fim,e.lote1_data_fim) is null or now()<coalesce(e.data_fim_inscricoes,e.lote3_data_fim,e.lote2_data_fim,e.lote1_data_fim))) then raise exception 'Aguarde o encerramento das inscrições para realizar o check-in.'; end if;
 if exists(select 1 from public.eventos where id=i.evento_id and status='ENCERRADO') then raise exception 'Evento encerrado.'; end if;
 select * into i from public.inscricoes where id=p_inscricao for update;
 if i.pagamento_ok is distinct from true or i.estorno_status='estornado' then raise exception 'Inscrição cancelada ou sem pagamento confirmado.'; end if;
 if exists(select 1 from public.recepcao_categorias where categoria_id=c.id and fechada) then raise exception 'Check-in da categoria já foi fechado.'; end if;
 if i.status_checkin::text is distinct from p_estado_anterior then raise exception 'Outro operador já conferiu esta inscrição. Atualize a lista antes de alterar.'; end if;
 if exists(select 1 from public.recepcao_inscricoes where inscricao_id=i.id and ausente) then raise exception 'Retire a ausência antes de conferir o atleta.'; end if;
 if p_peso is null or p_peso<=0 or p_peso>500 or p_status is null or p_status not in ('aprovado','desclassificado_peso','desclassificado_kimono') then raise exception 'Pesagem ou decisão inválida.'; end if;
 if p_status='aprovado' and (not coalesce(p_kimono,false) or (c.tipo='peso' and (p_peso<=coalesce(c.peso_min,0) or p_peso>coalesce(c.peso_max,500)))) then raise exception 'Confirme kimono e peso dentro da categoria.'; end if;
 update public.inscricoes set status_checkin=p_status::public.status_checkin_tipo,peso_aferido=p_peso,kimono_aprovado=p_kimono and p_status<>'desclassificado_kimono',pesagem_ok=p_status='aprovado',checkin_realizado_em=now(),checkin_realizado_por=auth.uid(),peso=case when p_status='aprovado' then p_peso::text else peso end where id=i.id;
 update public.atletas set peso=p_peso where id=i.atleta_id;
 return true;
end $$;
revoke all on function public.recepcao_salvar_checkin(bigint,numeric,boolean,text,text) from public,anon;
grant execute on function public.recepcao_salvar_checkin(bigint,numeric,boolean,text,text) to authenticated;

create or replace function public.recepcao_wo_tatame(p_luta uuid,p_lado integer,p_tatame text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare l public.chaves; cid uuid; v_nome text; v_id bigint; v_eq text; destino uuid; lado integer;
begin
 select categoria_id into cid from public.chaves where id=p_luta;
 perform 1 from public.categorias_evento where id=cid for update;
 select * into l from public.chaves where id=p_luta for update;
 if l.id is null or not public.recepcao_autorizar(l.evento_id,array['chamador','operacao']) then raise exception 'Posto sem autorização nesta luta.'; end if;
 if l.status_luta<>'agendada' or l.iniciada_em is not null or l.tatame is distinct from p_tatame then raise exception 'Luta iniciada, encerrada ou transferida. Atualize a fila.'; end if;
 if not exists(select 1 from public.recepcao_categorias where categoria_id=cid and fechada) then raise exception 'Categoria ainda não despachada.'; end if;
 if p_lado not in (0,1,2) or p_lado is null or l.atleta_1_id is null or l.atleta_2_id is null then raise exception 'Confronto inválido para ausência no tatame.'; end if;
 if (p_lado in (0,1) and (coalesce((l.pontuacao_atleta_1->>'chamador_presente')::boolean,false) or coalesce((l.pontuacao_atleta_1->>'chamador_chamadas')::integer,0)<3)) or
    (p_lado in (0,2) and (coalesce((l.pontuacao_atleta_2->>'chamador_presente')::boolean,false) or coalesce((l.pontuacao_atleta_2->>'chamador_chamadas')::integer,0)<3)) then raise exception 'Confirme três chamadas sem presença para cada ausente.'; end if;
 if (p_lado=1 and not coalesce((l.pontuacao_atleta_2->>'chamador_presente')::boolean,false)) or (p_lado=2 and not coalesce((l.pontuacao_atleta_1->>'chamador_presente')::boolean,false)) then raise exception 'Confirme a presença do oponente antes do W.O.'; end if;
 if (select count(distinct i.atleta_id) from public.inscricoes i where i.evento_id=l.evento_id and i.categoria_id=cid and i.atleta_id in (l.atleta_1_id,l.atleta_2_id) and i.pagamento_ok and i.estorno_status is distinct from 'estornado' and i.status_checkin='aprovado' and i.pesagem_ok and i.kimono_aprovado)<2 then raise exception 'Os atletas precisam estar aprovados na recepção.'; end if;
 v_nome:=case p_lado when 1 then l.atleta_2 when 2 then l.atleta_1 else 'BYE' end;
 v_id:=case p_lado when 1 then l.atleta_2_id when 2 then l.atleta_1_id else null end;
 v_eq:=case p_lado when 1 then l.equipe_2 when 2 then l.equipe_1 else '' end;
 update public.chaves set status_luta='concluida',vencedor=v_nome,vencedor_id=v_id,metodo_vitoria='wo',finalizada_em=now(),
 pontuacao_atleta_1=coalesce(pontuacao_atleta_1,'{}'::jsonb)||'{"recepcao_wo":true}'::jsonb,pontuacao_atleta_2=coalesce(pontuacao_atleta_2,'{}'::jsonb)||'{"recepcao_wo":true}'::jsonb where id=l.id;
 if l.proxima_luta is not null then
  select id into destino from public.chaves where evento_id=l.evento_id and categoria_id=cid and faixa is not distinct from l.faixa and id_visual=l.proxima_luta::text limit 1;
  if destino is null or exists(select 1 from public.chaves where id=destino and status_luta<>'agendada') then raise exception 'Destino já operado ou não encontrado.'; end if;
  lado:=case when l.id_visual::integer%2=1 then 1 else 2 end;
  if lado=1 then update public.chaves set atleta_1=v_nome,atleta_1_id=v_id,equipe_1=v_eq,pontuacao_atleta_1=coalesce(pontuacao_atleta_1,'{}'::jsonb)||jsonb_build_object('recepcao_vaga_ausente',v_id is null) where id=destino;
  else update public.chaves set atleta_2=v_nome,atleta_2_id=v_id,equipe_2=v_eq,pontuacao_atleta_2=coalesce(pontuacao_atleta_2,'{}'::jsonb)||jsonb_build_object('recepcao_vaga_ausente',v_id is null) where id=destino; end if;
 end if;
 perform public.recepcao_resolver_ausencias(cid);
 return jsonb_build_object('vencedor',v_nome,'ambos_ausentes',p_lado=0);
end $$;
revoke all on function public.recepcao_wo_tatame(uuid,integer,text) from public,anon;
grant execute on function public.recepcao_wo_tatame(uuid,integer,text) to authenticated;

-- Os caminhos antigos de chamada também ficam impedidos de operar categoria aberta.
create or replace function public.recepcao_proteger_despacho()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if (new.iniciada_em is not null and old.iniciada_em is null) or (new.status_luta='em_andamento' and old.status_luta<>'em_andamento') or
 (coalesce((new.pontuacao_atleta_1->>'chamador_presente')::boolean,false) and not coalesce((old.pontuacao_atleta_1->>'chamador_presente')::boolean,false)) or
 (coalesce((new.pontuacao_atleta_2->>'chamador_presente')::boolean,false) and not coalesce((old.pontuacao_atleta_2->>'chamador_presente')::boolean,false)) then
  perform 1 from public.categorias_evento where id=new.categoria_id for update;
  if not exists(select 1 from public.recepcao_categorias where categoria_id=new.categoria_id and fechada) then raise exception 'Feche o check-in desta categoria antes de despachar ao tatame.'; end if;
 end if;
 return new;
end $$;
drop trigger if exists recepcao_proteger_despacho on public.chaves;
create trigger recepcao_proteger_despacho before update on public.chaves for each row execute function public.recepcao_proteger_despacho();
create or replace function public.recepcao_proteger_pesagem()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.status_checkin is distinct from old.status_checkin or new.peso_aferido is distinct from old.peso_aferido or new.pesagem_ok is distinct from old.pesagem_ok or new.kimono_aprovado is distinct from old.kimono_aprovado then
  perform 1 from public.categorias_evento where id=new.categoria_id for update;
  if exists(select 1 from public.recepcao_categorias where categoria_id=new.categoria_id and fechada) then raise exception 'Check-in da categoria já foi fechado.'; end if;
 end if;
 return new;
end $$;
drop trigger if exists recepcao_proteger_pesagem on public.inscricoes;
create trigger recepcao_proteger_pesagem before update on public.inscricoes for each row execute function public.recepcao_proteger_pesagem();
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='recepcao_categorias') then
   alter publication supabase_realtime add table public.recepcao_categorias;
  end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='recepcao_inscricoes') then
   alter publication supabase_realtime add table public.recepcao_inscricoes;
  end if;
 end if;
end $$;


-- Produção: estrutura aditiva. Não altera cadastros, pagamentos ou resultados existentes.

create table if not exists public.chaves_publicacoes (
 categoria_id uuid primary key references public.categorias_evento(id) on delete cascade,
 evento_id uuid not null references public.eventos(id) on delete cascade,
 publicada boolean not null default false, revisao bigint not null default 1,
 publicada_em timestamptz, publicada_por uuid
);
create table if not exists public.chaves_revisoes (
 id bigint generated always as identity primary key, categoria_id uuid not null,
 evento_id uuid not null, operador uuid not null, realizada_em timestamptz not null default now(),
 acao text not null, motivo text, antes jsonb, depois jsonb
);
-- Chaves anteriores continuam divulgadas, inclusive as que já estão em operação.
insert into public.chaves_publicacoes(categoria_id,evento_id,publicada,publicada_em)
 select distinct categoria_id,evento_id,true,now() from public.chaves where categoria_id is not null
 on conflict do nothing;
alter table public.chaves_publicacoes enable row level security;
alter table public.chaves_revisoes enable row level security;
drop policy if exists publicacao_leitura on public.chaves_publicacoes;
create policy publicacao_leitura on public.chaves_publicacoes for select using(true);
drop policy if exists revisoes_organizador on public.chaves_revisoes;
create policy revisoes_organizador on public.chaves_revisoes for select using(exists(select 1 from public.eventos e where e.id=evento_id and e.organizador_id=auth.uid()));
grant select on public.chaves_publicacoes to anon,authenticated;
grant select on public.chaves_revisoes to authenticated;
grant all on public.chaves_publicacoes,public.chaves_revisoes to service_role;
-- RESTRICTIVE: também restringe a política pública já existente.
drop policy if exists chaves_somente_publicadas on public.chaves;
create policy chaves_somente_publicadas on public.chaves as restrictive for select to anon,authenticated
 using(exists(select 1 from public.chaves_publicacoes p where p.categoria_id=chaves.categoria_id and p.publicada)
 or exists(select 1 from public.eventos e where e.id=chaves.evento_id and e.organizador_id=auth.uid()));

create or replace function public.chaves_marcar_rascunho() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.categoria_id is null then raise exception 'A chave precisa de uma categoria vinculada para revisão.'; end if;
 perform 1 from public.categorias_evento where id=new.categoria_id for update;
 if public.chaves_categoria_travada(new.categoria_id) then raise exception 'Categoria já em operação. Não regenere suas chaves.'; end if;
 insert into public.chaves_publicacoes(categoria_id,evento_id) values(new.categoria_id,new.evento_id)
 on conflict(categoria_id) do update set publicada=false,revisao=chaves_publicacoes.revisao+1,publicada_em=null,publicada_por=null;
 return new;
end $$;
drop trigger if exists chaves_marcar_rascunho on public.chaves;
create trigger chaves_marcar_rascunho before insert on public.chaves for each row execute function public.chaves_marcar_rascunho();

-- Uma posição inicial nunca recebe vencedor/perdedor de outra luta.
create or replace function public.chaves_posicao_inicial(p_luta uuid,p_lado integer) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select p_lado in (1,2) and case
 when l.fase like '%Chave de 3%' or l.fase like '%Chave de 6%' then
   (l.id_visual in ('1','3') or (l.id_visual in ('2','4') and p_lado=2))
 else not exists(select 1 from public.chaves f where f.evento_id=l.evento_id and f.categoria_id=l.categoria_id
 and f.categoria is not distinct from l.categoria and f.faixa is not distinct from l.faixa
 and f.proxima_luta::text=l.id_visual and (case when f.id_visual::integer%2=1 then 1 else 2 end)=p_lado) end
 from public.chaves l where l.id=p_luta
$$;
create or replace function public.chaves_categoria_travada(p_categoria uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.recepcao_categorias where categoria_id=p_categoria and fechada)
 or exists(select 1 from public.chaves l where l.categoria_id=p_categoria and (
 l.iniciada_em is not null or l.status_luta='em_andamento'
 or (l.vencedor is not null and (l.atleta_1_id is not null or l.atleta_2_id is not null))
 or coalesce((l.pontuacao_atleta_1->>'chamador_presente')::boolean,false)
 or coalesce((l.pontuacao_atleta_2->>'chamador_presente')::boolean,false)
 or coalesce((l.pontuacao_atleta_1->>'chamador_chamadas')::integer,0)>0
 or coalesce((l.pontuacao_atleta_2->>'chamador_chamadas')::integer,0)>0
 or (l.atleta_1_id is not null and not public.chaves_posicao_inicial(l.id,1))
 or (l.atleta_2_id is not null and not public.chaves_posicao_inicial(l.id,2))))
$$;
create or replace function public.chaves_revisar(p_categoria uuid,p_revisao bigint,p_acao text,p_luta_a uuid default null,p_lado_a integer default null,p_luta_b uuid default null,p_lado_b integer default null,p_motivo text default null)
 returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare ev uuid; p public.chaves_publicacoes; a public.chaves; b public.chaves; x jsonb; y jsonb;
begin
 select evento_id into ev from public.categorias_evento where id=p_categoria for update;
 if ev is null or not exists(select 1 from public.eventos where id=ev and organizador_id=auth.uid()) then raise exception 'Somente o organizador deste evento pode revisar.'; end if;
 select * into p from public.chaves_publicacoes where categoria_id=p_categoria for update;
 if p.categoria_id is null or p.revisao<>p_revisao then raise exception 'As chaves mudaram. Atualize a revisão.'; end if;
 if public.chaves_categoria_travada(p_categoria) then raise exception 'Categoria já em operação. Não é possível alterar sua publicação ou posições.'; end if;
 if p_acao='revisar' then
  if not p.publicada then raise exception 'A categoria já está em revisão.'; end if;
  if length(trim(coalesce(p_motivo,'')))<3 then raise exception 'Informe o motivo para retirar da divulgação.'; end if;
  update public.chaves_publicacoes set publicada=false,revisao=revisao+1,publicada_em=null,publicada_por=null where categoria_id=p_categoria;
 elsif p_acao='publicar' then
  if p.publicada then raise exception 'Esta categoria já foi publicada.'; end if;
  if not exists(select 1 from public.chaves where categoria_id=p_categoria) then raise exception 'Gere as chaves antes de publicar.'; end if;
  if exists(select 1 from public.chaves l cross join lateral(values(1,l.atleta_1_id),(2,l.atleta_2_id)) s(lado,atleta)
    where l.categoria_id=p_categoria and s.atleta is not null and public.chaves_posicao_inicial(l.id,s.lado)
    group by l.categoria,l.faixa,s.atleta having count(*)>1) then raise exception 'Atleta repetido nas posições iniciais. Confira a chave.'; end if;
  if exists(select 1 from public.chaves l cross join lateral(values(1,l.atleta_1_id),(2,l.atleta_2_id)) s(lado,atleta)
    where l.categoria_id=p_categoria and s.atleta is not null and public.chaves_posicao_inicial(l.id,s.lado)
    and not exists(select 1 from public.inscricoes i where i.evento_id=ev and i.categoria_id=p_categoria and i.atleta_id=s.atleta and i.pagamento_ok and coalesce(i.estorno_status,'')<>'estornado')) then
    raise exception 'Há atleta sem inscrição ativa e pagamento confirmado. Confira antes de publicar.';
  end if;
  update public.chaves_publicacoes set publicada=true,revisao=revisao+1,publicada_em=now(),publicada_por=auth.uid() where categoria_id=p_categoria;
 elsif p_acao='trocar' then
  if p.publicada then raise exception 'Retire esta categoria da divulgação antes de trocar posições.'; end if;
  if p_lado_a not in (1,2) or p_lado_b not in (1,2) or p_lado_a is null or p_lado_b is null then raise exception 'Posição inválida.'; end if;
  if p_luta_a=p_luta_b and p_lado_a=p_lado_b then raise exception 'Escolha duas posições diferentes.'; end if;
  select * into a from public.chaves where id=p_luta_a and categoria_id=p_categoria for update;
  select * into b from public.chaves where id=p_luta_b and categoria_id=p_categoria for update;
  if a.id is null or b.id is null or a.categoria is distinct from b.categoria or a.faixa is distinct from b.faixa then raise exception 'Troque somente atletas da mesma divisão e faixa.'; end if;
  if not coalesce(public.chaves_posicao_inicial(a.id,p_lado_a),false) or not coalesce(public.chaves_posicao_inicial(b.id,p_lado_b),false) then raise exception 'Somente posições iniciais podem ser trocadas.'; end if;
  x=jsonb_build_object('nome',case p_lado_a when 1 then a.atleta_1 else a.atleta_2 end,'id',case p_lado_a when 1 then a.atleta_1_id else a.atleta_2_id end,'equipe',case p_lado_a when 1 then a.equipe_1 else a.equipe_2 end,'numero',case p_lado_a when 1 then a.numero_1 else a.numero_2 end);
  y=jsonb_build_object('nome',case p_lado_b when 1 then b.atleta_1 else b.atleta_2 end,'id',case p_lado_b when 1 then b.atleta_1_id else b.atleta_2_id end,'equipe',case p_lado_b when 1 then b.equipe_1 else b.equipe_2 end,'numero',case p_lado_b when 1 then b.numero_1 else b.numero_2 end);
  if x->>'id' is null or y->>'id' is null then raise exception 'Escolha dois atletas, sem vagas vazias.'; end if;
  if length(trim(coalesce(p_motivo,'')))<3 then raise exception 'Informe o motivo da troca.'; end if;
  update public.chaves set
   atleta_1=case when p_lado_a=1 then y->>'nome' else atleta_1 end,atleta_1_id=case when p_lado_a=1 then (y->>'id')::bigint else atleta_1_id end,equipe_1=case when p_lado_a=1 then y->>'equipe' else equipe_1 end,numero_1=case when p_lado_a=1 then y->>'numero' else numero_1 end,
   atleta_2=case when p_lado_a=2 then y->>'nome' else atleta_2 end,atleta_2_id=case when p_lado_a=2 then (y->>'id')::bigint else atleta_2_id end,equipe_2=case when p_lado_a=2 then y->>'equipe' else equipe_2 end,numero_2=case when p_lado_a=2 then y->>'numero' else numero_2 end where id=a.id;
  update public.chaves set
   atleta_1=case when p_lado_b=1 then x->>'nome' else atleta_1 end,atleta_1_id=case when p_lado_b=1 then (x->>'id')::bigint else atleta_1_id end,equipe_1=case when p_lado_b=1 then x->>'equipe' else equipe_1 end,numero_1=case when p_lado_b=1 then x->>'numero' else numero_1 end,
   atleta_2=case when p_lado_b=2 then x->>'nome' else atleta_2 end,atleta_2_id=case when p_lado_b=2 then (x->>'id')::bigint else atleta_2_id end,equipe_2=case when p_lado_b=2 then x->>'equipe' else equipe_2 end,numero_2=case when p_lado_b=2 then x->>'numero' else numero_2 end where id=b.id;
  update public.chaves_publicacoes set revisao=revisao+1 where categoria_id=p_categoria;
 else raise exception 'Ação inválida.'; end if;
 insert into public.chaves_revisoes(categoria_id,evento_id,operador,acao,motivo,antes,depois) values(p_categoria,ev,auth.uid(),p_acao,trim(p_motivo),jsonb_build_object('publicacao',to_jsonb(p),'a',x,'b',y),jsonb_build_object('a',y,'b',x,'luta_a',p_luta_a,'lado_a',p_lado_a,'luta_b',p_luta_b,'lado_b',p_lado_b));
 return jsonb_build_object('ok',true);
end $$;
create or replace function public.chaves_bloquear_despacho_rascunho() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform 1 from public.categorias_evento where id=new.categoria_id for update;
 if new.fechada and not exists(select 1 from public.chaves_publicacoes where categoria_id=new.categoria_id and publicada) then raise exception 'Publique as chaves desta categoria antes de fechar o check-in.'; end if;
 return new;
end $$;
drop trigger if exists chaves_bloquear_despacho_rascunho on public.recepcao_categorias;
create trigger chaves_bloquear_despacho_rascunho before insert or update on public.recepcao_categorias for each row execute function public.chaves_bloquear_despacho_rascunho();
revoke all on function public.chaves_revisar(uuid,bigint,text,uuid,integer,uuid,integer,text) from public;
grant execute on function public.chaves_revisar(uuid,bigint,text,uuid,integer,uuid,integer,text) to authenticated;
revoke all on function public.chaves_posicao_inicial(uuid,integer),public.chaves_categoria_travada(uuid),public.chaves_marcar_rascunho(),public.chaves_bloquear_despacho_rascunho() from public;
create or replace function public.chaves_revisao_listar(p_evento uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not exists(select 1 from public.eventos where id=p_evento and organizador_id=auth.uid()) then raise exception 'Acesso exclusivo do organizador do evento.'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('categoria_id',p.categoria_id,'nome',c.nome,'publicada',p.publicada,'revisao',p.revisao,'travada',public.chaves_categoria_travada(p.categoria_id),
 'posicoes',coalesce((select jsonb_agg(jsonb_build_object('luta',l.id,'lado',s.lado,'atleta',s.nome,'equipe',s.equipe,'divisao',l.categoria,'faixa',l.faixa,'ordem',l.ordem,'fase',l.fase,'peso',(select coalesce(i.peso_aferido::text,i.peso) from public.inscricoes i where i.evento_id=p_evento and i.categoria_id=p.categoria_id and i.atleta_id=s.atleta order by i.id desc limit 1)) order by l.ordem,s.lado)
 from public.chaves l cross join lateral(values(1,l.atleta_1_id,l.atleta_1,l.equipe_1),(2,l.atleta_2_id,l.atleta_2,l.equipe_2)) s(lado,atleta,nome,equipe)
 where l.categoria_id=p.categoria_id and s.atleta is not null and public.chaves_posicao_inicial(l.id,s.lado)),'[]'::jsonb)) order by c.nome)
 from public.chaves_publicacoes p join public.categorias_evento c on c.id=p.categoria_id where p.evento_id=p_evento),'[]'::jsonb);
end $$;
revoke all on function public.chaves_revisao_listar(uuid) from public;
grant execute on function public.chaves_revisao_listar(uuid) to authenticated;
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='chaves_publicacoes') then
  alter publication supabase_realtime add table public.chaves_publicacoes;
 end if;
end $$;



-- Instala somente a função. Não ajusta nenhum contador existente.

create or replace function public.ajustar_medalha_staff(p_atleta bigint,p_coluna text,p_incremento integer)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare ev uuid;
begin
 if auth.uid() is null then raise exception 'Sessão ausente.'; end if;
 if p_coluna is null or p_coluna not in ('ouro','prata','bronze','vitorias_wo')
 or p_incremento is null or p_incremento not in (-1,1) then raise exception 'Ajuste inválido.'; end if;
 select s.evento_id into ev from public.staff_sessoes s
 join public.staff_eventos st on st.id=s.staff_evento_id and st.evento_id=s.evento_id
 where s.auth_user_id=auth.uid() and s.expira_em>now() and st.funcao='mesario' limit 1;
 if ev is null or not exists(select 1 from public.inscricoes i where i.evento_id=ev
 and i.atleta_id=p_atleta and i.pagamento_ok=true and i.estorno_status is distinct from 'estornado')
 then raise exception 'Mesário ou atleta fora do evento autorizado.'; end if;
 update public.atletas set
 ouro=case when p_coluna='ouro' then greatest(0,coalesce(ouro,0)+p_incremento) else ouro end,
 prata=case when p_coluna='prata' then greatest(0,coalesce(prata,0)+p_incremento) else prata end,
 bronze=case when p_coluna='bronze' then greatest(0,coalesce(bronze,0)+p_incremento) else bronze end,
 vitorias_wo=case when p_coluna='vitorias_wo' then greatest(0,coalesce(vitorias_wo,0)+p_incremento) else vitorias_wo end
 where id=p_atleta;
 if not found then raise exception 'Atleta não encontrado.'; end if;
end $$;
revoke all on function public.ajustar_medalha_staff(bigint,text,integer) from public,anon;
grant execute on function public.ajustar_medalha_staff(bigint,text,integer) to authenticated;


create temporary table integracao_hashes_depois on commit drop as select 'eventos' as tabela,count(*) as total,md5(coalesce(string_agg(md5(row_to_json(t)::text),'' order by t.id),'vazio')) as hash from public.eventos t where id='7885981f-90e7-41ad-86f2-2bd328a7088c'
union all select 'inscricoes',count(*),md5(coalesce(string_agg(md5(row_to_json(t)::text),'' order by t.id),'vazio')) from public.inscricoes t where evento_id='7885981f-90e7-41ad-86f2-2bd328a7088c'
union all select 'categorias_evento',count(*),md5(coalesce(string_agg(md5(row_to_json(t)::text),'' order by t.id),'vazio')) from public.categorias_evento t where evento_id='7885981f-90e7-41ad-86f2-2bd328a7088c'
union all select 'chaves',count(*),md5(coalesce(string_agg(md5(row_to_json(t)::text),'' order by t.id),'vazio')) from public.chaves t where evento_id='7885981f-90e7-41ad-86f2-2bd328a7088c'
union all select 'staff_eventos',count(*),md5(coalesce(string_agg(md5(row_to_json(t)::text),'' order by t.id),'vazio')) from public.staff_eventos t where evento_id='7885981f-90e7-41ad-86f2-2bd328a7088c'
union all select 'atletas',count(*),md5(coalesce(string_agg(md5(row_to_json(t)::text),'' order by t.id),'vazio')) from public.atletas t where id in(select atleta_id from public.inscricoes where evento_id='7885981f-90e7-41ad-86f2-2bd328a7088c');
do $$ begin
 if exists(select * from integracao_hashes_antes except select * from integracao_hashes_depois) or exists(select * from integracao_hashes_depois except select * from integracao_hashes_antes) then raise exception 'Registros existentes mudaram durante a implantação. Transação cancelada para nova conferência.'; end if;
end $$;
commit;
notify pgrst,'reload schema';
select 'Estrutura instalada; hashes dos registros existentes conferidos e idênticos; nenhuma chave gerada.' as resultado;

