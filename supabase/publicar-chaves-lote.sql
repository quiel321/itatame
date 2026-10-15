-- Produção: instala funções e proteções, sem executar operações ou alterar registros.
begin;
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
commit;
notify pgrst,'reload schema';
