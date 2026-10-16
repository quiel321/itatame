-- Corrige somente a validação da publicação. Não atualiza inscrições, pagamentos ou chaves.
begin;
create or replace function public.chaves_normalizar_publicacao(valor text) returns text
language sql immutable set search_path=public,pg_temp as $$
 select translate(upper(regexp_replace(trim(coalesce(valor,'')),'\s+',' ','g')),'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ','AAAAAEEEEIIIIOOOOOUUUUCN')
$$;
create or replace function public.chaves_inscricao_categoria_compativel(i public.inscricoes,p_categoria uuid)
returns boolean language sql stable set search_path=public,pg_temp as $$
 select exists(select 1 from public.categorias_evento c
 where c.id=p_categoria and c.evento_id=i.evento_id and
 case when c.tipo='absoluto' then
  c.ativa and i.absoluto is true
  and i.idade between c.idade_min and c.idade_max
  and public.chaves_normalizar_publicacao(i.sexo)=public.chaves_normalizar_publicacao(c.sexo)
  and (coalesce(i.modalidade,'')='' or public.chaves_normalizar_publicacao(i.modalidade)=public.chaves_normalizar_publicacao(c.modalidade))
  and (public.chaves_normalizar_publicacao(c.faixa) in ('TODAS','TODAS AS FAIXAS','TODAS FAIXAS','LIVRE')
   or exists(select 1 from regexp_split_to_table(c.faixa,'[,/·;]+') f(valor)
    where public.chaves_normalizar_publicacao(f.valor)=public.chaves_normalizar_publicacao(i.faixa)))
  and ((coalesce(c.peso_min,0)<=0 and c.peso_max is null) or case
   when replace(trim(coalesce(i.peso::text,'')),',','.') ~ '^[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)$'
   then replace(trim(i.peso::text),',','.')::numeric>c.peso_min
    and (c.peso_max is null or replace(trim(i.peso::text),',','.')::numeric<=c.peso_max)
   else false end)
 else i.categoria_id=p_categoria end)
$$;
-- Substituição restrita preserva todas as demais proteções e a auditoria da função instalada.
do $migracao$
declare definicao text;
 antigo text := 'i.evento_id=ev and i.categoria_id=p_categoria and i.atleta_id=s.atleta and i.pagamento_ok and coalesce(i.estorno_status,'''')<>''estornado''';
 novo text := 'i.evento_id=ev and i.atleta_id=s.atleta and i.pagamento_ok and coalesce(i.estorno_status,'''')<>''estornado'' and public.chaves_inscricao_categoria_compativel(i,p_categoria)';
begin
 select pg_get_functiondef('public.chaves_revisar(uuid,bigint,text,uuid,integer,uuid,integer,text)'::regprocedure) into definicao;
 if strpos(definicao,antigo)>0 then
  if (length(definicao)-length(replace(definicao,antigo,'')))/length(antigo)<>1 then raise exception 'Validação inesperada; nenhuma alteração aplicada.'; end if;
  execute replace(definicao,antigo,novo);
 elsif strpos(definicao,novo)=0 then raise exception 'Validação diferente da esperada; nenhuma alteração aplicada.';
 end if;
end $migracao$;
revoke all on function public.chaves_normalizar_publicacao(text),public.chaves_inscricao_categoria_compativel(public.inscricoes,uuid) from public;
commit;
