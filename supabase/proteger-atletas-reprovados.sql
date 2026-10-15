-- Produção: instala funções e proteções, sem executar operações ou alterar registros.
begin;
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
commit;
