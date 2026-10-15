-- Produção: instala funções e proteções, sem executar operações ou alterar registros.
begin;
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
commit;
notify pgrst,'reload schema';
