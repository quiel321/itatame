-- Instalação autorizada em produção. Não executa geração, publicação, check-in ou resultados.
begin isolation level repeatable read;
do $$ begin
 if not exists(select 1 from public.eventos where id='7885981f-90e7-41ad-86f2-2bd328a7088c' and nome='3º Campeonato Interno Spartan')
 or to_regnamespace('ensaio_itatame') is not null then raise exception 'Destino incorreto: este pacote é exclusivo do iTatame real.'; end if;
 if to_regprocedure('public.chaves_revisar(uuid,bigint,text,uuid,integer,uuid,integer,text)') is null or to_regprocedure('public.recepcao_operar(uuid,text,bigint)') is null then raise exception 'Estrutura de operação anterior não encontrada.'; end if;
end $$;
create temp table prova_operacao_real(tabela text primary key, registros bigint, hash text) on commit drop;
do $$ declare t record; n bigint; h text; begin
 for t in select tablename from pg_tables where schemaname='public' and tablename in ('eventos','atletas','inscricoes','categorias_evento','chaves','staff_eventos','staff_sessoes','recepcao_categorias','recepcao_inscricoes','chaves_publicacoes','chaves_revisoes','inscricao_estornos','resultados_manuais','pagamentos') loop
 execute format('select count(*),md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text, %L)) from public.%I t','',t.tablename) into n,h;
 insert into prova_operacao_real values(t.tablename,n,h); end loop;
end $$;

-- Produção: instala funções e proteções, sem executar operações ou alterar registros.

create or replace function public.chaves_publicar_todas(p_evento uuid,p_categorias jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare c record; total integer:=0;
begin
 if auth.uid() is null or not exists(select 1 from public.eventos
 where id=p_evento and organizador_id=auth.uid()) then
  raise exception 'Somente o organizador deste evento pode publicar as chaves.';
 end if;
 if p_categorias is null or jsonb_typeof(p_categorias)<>'array' then raise exception 'Atualize a revisão antes de publicar.'; end if;
 if exists(select 1 from jsonb_to_recordset(p_categorias) x(categoria_id uuid,revisao bigint)
 where categoria_id is null or revisao is null) or jsonb_array_length(p_categorias)<>
 (select count(distinct categoria_id) from jsonb_to_recordset(p_categorias) x(categoria_id uuid,revisao bigint)) then
  raise exception 'Lista de categorias inválida. Atualize a revisão.';
 end if;
 -- Mesma ordem para todas as publicações; impede publicação sobre uma revisão concorrente.
 perform 1 from public.categorias_evento where evento_id=p_evento order by id for update;
 perform 1 from public.chaves_publicacoes where evento_id=p_evento order by categoria_id for update;
 if exists(
  select categoria_id,revisao from public.chaves_publicacoes where evento_id=p_evento and not publicada
  except select categoria_id,revisao from jsonb_to_recordset(p_categorias) x(categoria_id uuid,revisao bigint)
 ) or exists(
  select categoria_id,revisao from jsonb_to_recordset(p_categorias) x(categoria_id uuid,revisao bigint)
  except select categoria_id,revisao from public.chaves_publicacoes where evento_id=p_evento and not publicada
 ) then raise exception 'As chaves mudaram. Atualize a revisão e confira antes de publicar todas.'; end if;
 for c in select p.categoria_id,p.revisao,cat.nome from public.chaves_publicacoes p
 join public.categorias_evento cat on cat.id=p.categoria_id
 where p.evento_id=p_evento and not p.publicada order by p.categoria_id loop
  begin
   -- Reutiliza autorização, pagamento, duplicidade, bloqueio operacional e auditoria individuais.
   perform public.chaves_revisar(c.categoria_id,c.revisao,'publicar');
  exception when others then
   raise exception 'Não foi possível publicar a categoria "%": %. Nenhuma categoria foi publicada neste lote.',c.nome,sqlerrm;
  end;
  total:=total+1;
 end loop;
 return jsonb_build_object('ok',true,'publicadas',total);
end $$;
revoke all on function public.chaves_publicar_todas(uuid,jsonb) from public,anon;
grant execute on function public.chaves_publicar_todas(uuid,jsonb) to authenticated;



-- Produção: instala funções e proteções, sem executar operações ou alterar registros.

create or replace function public.tatame_operacao_nome(p_nome text) returns text
language sql immutable as $$
 select translate(upper(regexp_replace(btrim(coalesce(p_nome,'')),'[[:space:]]+',' ','g')),
 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ','AAAAAEEEEIIIIOOOOOUUUUC');
$$;
create or replace function public.tatame_luta_valido(p_evento uuid,p_tatame text,p_ordem integer,p_luta uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce(p_ordem,0)>0 and public.tatame_operacao_nome(p_tatame) not in ('','SEM TATAME','NAO DEFINIDO')
 and exists(select 1 from public.staff_eventos s where s.evento_id=p_evento and s.funcao='mesario'
 and public.tatame_operacao_nome(s.identificacao)=public.tatame_operacao_nome(p_tatame))
 and not exists(select 1 from public.chaves l where l.evento_id=p_evento and l.id<>p_luta
 and l.ordem_tatame=p_ordem and public.tatame_operacao_nome(l.tatame)=public.tatame_operacao_nome(p_tatame));
$$;
create or replace function public.tatames_categoria_pronta(p_categoria uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.chaves where categoria_id=p_categoria)
 and not exists(select 1 from public.chaves l where l.categoria_id=p_categoria
 and not public.tatame_luta_valido(l.evento_id,l.tatame,l.ordem_tatame,l.id));
$$;
create or replace function public.recepcao_validar_tatames() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.fechada and not public.tatames_categoria_pronta(new.categoria_id) then
  raise exception 'O organizador precisa distribuir esta categoria e salvar a sequência em Organizar tatames antes de despachar. Confirme os postos de mesário e a ordem de todas as lutas.';
 end if;
 return new;
end $$;
create or replace function public.chamador_validar_tatame() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if (new.iniciada_em is not null and new.iniciada_em is distinct from old.iniciada_em)
 or (new.status_luta='em_andamento' and old.status_luta<>'em_andamento')
 or (coalesce((new.pontuacao_atleta_1->>'chamador_presente')::boolean,false) and not coalesce((old.pontuacao_atleta_1->>'chamador_presente')::boolean,false))
 or (coalesce((new.pontuacao_atleta_2->>'chamador_presente')::boolean,false) and not coalesce((old.pontuacao_atleta_2->>'chamador_presente')::boolean,false))
 or (coalesce((new.pontuacao_atleta_1->>'chamador_chamadas')::integer,0)>coalesce((old.pontuacao_atleta_1->>'chamador_chamadas')::integer,0))
 or (coalesce((new.pontuacao_atleta_2->>'chamador_chamadas')::integer,0)>coalesce((old.pontuacao_atleta_2->>'chamador_chamadas')::integer,0)) then
  if not public.tatame_luta_valido(new.evento_id,new.tatame,new.ordem_tatame,new.id) then
   raise exception 'Luta sem tatame válido ou sequência salva. Peça ao organizador para salvar a distribuição em Organizar tatames antes de liberar os atletas.';
  end if;
 end if;
 return new;
end $$;
drop trigger if exists recepcao_validar_tatames on public.recepcao_categorias;
create trigger recepcao_validar_tatames before insert or update on public.recepcao_categorias
for each row execute function public.recepcao_validar_tatames();
drop trigger if exists chamador_validar_tatame on public.chaves;
create trigger chamador_validar_tatame before update on public.chaves
for each row execute function public.chamador_validar_tatame();
revoke all on function public.tatame_operacao_nome(text),public.tatame_luta_valido(uuid,text,integer,uuid),
public.tatames_categoria_pronta(uuid),public.recepcao_validar_tatames(),public.chamador_validar_tatame() from public;



-- Produção: instala funções e proteções, sem executar operações ou alterar registros.

create or replace function public.atleta_liberado_operacao(p_evento uuid,p_categoria uuid,p_atleta bigint)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.inscricoes i
 left join public.recepcao_inscricoes r on r.inscricao_id=i.id
 where i.evento_id=p_evento and i.categoria_id=p_categoria and i.atleta_id=p_atleta
 and i.pagamento_ok and i.estorno_status is distinct from 'estornado'
 and i.status_checkin='aprovado' and i.pesagem_ok and i.kimono_aprovado and not coalesce(r.ausente,false));
$$;
create or replace function public.proteger_elegibilidade_luta() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare iniciar boolean; presenca1 boolean; presenca2 boolean;
begin
 iniciar:=(new.status_luta='em_andamento' and old.status_luta<>'em_andamento') or
 (new.iniciada_em is not null and new.iniciada_em is distinct from old.iniciada_em);
 presenca1:=coalesce((new.pontuacao_atleta_1->>'chamador_presente')::boolean,false) and not coalesce((old.pontuacao_atleta_1->>'chamador_presente')::boolean,false);
 presenca2:=coalesce((new.pontuacao_atleta_2->>'chamador_presente')::boolean,false) and not coalesce((old.pontuacao_atleta_2->>'chamador_presente')::boolean,false);
 if iniciar or presenca1 or presenca2 then
   perform 1 from public.categorias_evento where id=new.categoria_id for update;
   if (iniciar or presenca1) and not public.atleta_liberado_operacao(new.evento_id,new.categoria_id,new.atleta_1_id) then
     raise exception 'Atleta não liberado pela recepção: reprovado, ausente ou com conferência pendente.';
   end if;
   if (iniciar or presenca2) and not public.atleta_liberado_operacao(new.evento_id,new.categoria_id,new.atleta_2_id) then
     raise exception 'Atleta não liberado pela recepção: reprovado, ausente ou com conferência pendente.';
   end if;
   if (presenca1 and new.atleta_2_id is not null and exists(select 1 from public.inscricoes i where i.evento_id=new.evento_id and i.categoria_id=new.categoria_id and i.atleta_id=new.atleta_2_id and i.status_checkin::text like 'desclassificado_%')) or
      (presenca2 and new.atleta_1_id is not null and exists(select 1 from public.inscricoes i where i.evento_id=new.evento_id and i.categoria_id=new.categoria_id and i.atleta_id=new.atleta_1_id and i.status_checkin::text like 'desclassificado_%')) then
      raise exception 'Não haverá combate com atleta reprovado. Aguarde o avanço automático da chave.';
   end if;
 end if;
 return new;
end $$;
revoke all on function public.atleta_liberado_operacao(uuid,uuid,bigint),public.proteger_elegibilidade_luta() from public;
drop trigger if exists proteger_elegibilidade_luta on public.chaves;
create trigger proteger_elegibilidade_luta before update on public.chaves for each row execute function public.proteger_elegibilidade_luta();

-- Produção: instala funções e proteções, sem executar operações ou alterar registros.

create or replace function public.recepcao_resolver_ausencias(p_categoria uuid)
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare ev uuid; l public.chaves; rodada integer; total integer:=0; mudou boolean;
 r1 boolean; r2 boolean; ok1 boolean; ok2 boolean; a1 boolean; a2 boolean;
 vencedor_nome text; vencedor_num bigint; vencedor_eq text; destino uuid; lado integer; atual_id uuid; destino_ja_atualizado boolean; d public.chaves;
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
   -- O cursor guarda um retrato. Uma luta anterior pode ter preenchido este confronto.
   atual_id:=l.id;
   select * into l from public.chaves where id=atual_id;
   if l.status_luta<>'agendada' or l.iniciada_em is not null then continue; end if;
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
    select * into d from public.chaves where id=destino;
    destino_ja_atualizado:=false;
    if d.status_luta<>'agendada' or d.iniciada_em is not null then
     destino_ja_atualizado:=case when lado=1 then
      d.atleta_1_id is not distinct from vencedor_num and (vencedor_num is not null or upper(coalesce(d.atleta_1,'BYE')) in ('BYE','SEM OPONENTE',''))
     else d.atleta_2_id is not distinct from vencedor_num and (vencedor_num is not null or upper(coalesce(d.atleta_2,'BYE')) in ('BYE','SEM OPONENTE','')) end;
     if not destino_ja_atualizado then raise exception 'Próxima luta já foi operada; procure o organizador.'; end if;
    end if;
    if not destino_ja_atualizado then
    if lado=1 then update public.chaves set atleta_1=vencedor_nome,atleta_1_id=vencedor_num,equipe_1=vencedor_eq,
     pontuacao_atleta_1=coalesce(pontuacao_atleta_1,'{}'::jsonb)||jsonb_build_object('recepcao_vaga_ausente',vencedor_num is null) where id=destino;
    else update public.chaves set atleta_2=vencedor_nome,atleta_2_id=vencedor_num,equipe_2=vencedor_eq,
     pontuacao_atleta_2=coalesce(pontuacao_atleta_2,'{}'::jsonb)||jsonb_build_object('recepcao_vaga_ausente',vencedor_num is null) where id=destino; end if;
    end if;
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



grant select on public.chaves_publicacoes to service_role;
do $$ declare t record; n bigint; h text; begin
 for t in select * from prova_operacao_real loop
 execute format('select count(*),md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text, %L)) from public.%I t','',t.tabela) into n,h;
 if n is distinct from t.registros or h is distinct from t.hash then raise exception 'Registros de % alterados: instalação cancelada.',t.tabela; end if; end loop;
end $$;
select true dados_preservados, count(*) tabelas_conferidas, (select count(*) from public.chaves where evento_id='7885981f-90e7-41ad-86f2-2bd328a7088c') lutas_inalteradas, 'Somente funções e proteções instaladas; inscrições, pagamentos, atletas e operação preservados.' conferencia from prova_operacao_real;
notify pgrst,'reload schema';
commit;
