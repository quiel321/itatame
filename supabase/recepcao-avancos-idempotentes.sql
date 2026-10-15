-- Produção: instala funções e proteções, sem executar operações ou alterar registros.
begin;
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


commit;
