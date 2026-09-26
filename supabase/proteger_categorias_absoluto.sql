-- Protege categorias absolutas com inscricoes elegiveis, mesmo sem categoria_id.
-- Tambem protege contra exclusao antes da geracao das chaves.
create or replace function public.proteger_categoria_utilizada() returns trigger
language plpgsql set search_path=public as $$
begin
  if exists(select 1 from public.inscricoes where categoria_id=old.id)
    or exists(select 1 from public.chaves where categoria_id=old.id)
    or (old.tipo='absoluto' and exists (
      select 1 from public.inscricoes i
      where i.evento_id=old.evento_id and i.absoluto=true
        and i.idade between old.idade_min and old.idade_max
        and lower(trim(i.sexo))=lower(trim(old.sexo))
        and (nullif(trim(i.modalidade),'') is null or lower(trim(i.modalidade))=lower(trim(old.modalidade)))
        and (
          lower(trim(old.faixa)) in ('todas', 'todas as faixas', 'todas faixas', 'livre')
          or exists (
            select 1 from regexp_split_to_table(old.faixa, '[,;/·]+') as faixa_permitida(valor)
            where lower(trim(faixa_permitida.valor))=lower(trim(i.faixa))
          )
        )
        and (
          (old.peso_min=0 and old.peso_max is null)
          or case
            when replace(trim(coalesce(i.peso,'')),',','.') ~ '^[0-9]+([.][0-9]+)?$'
            then replace(trim(i.peso),',','.')::numeric>old.peso_min
              and (old.peso_max is null or replace(trim(i.peso),',','.')::numeric<=old.peso_max)
            else false
          end
        )
    )) then
    raise exception 'Categoria em uso. Crie outra categoria para preservar as inscrições existentes.';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
create or replace trigger proteger_categoria_utilizada before update or delete on public.categorias_evento
for each row execute function public.proteger_categoria_utilizada();
