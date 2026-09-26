-- Permite a faixa individual do atleta dentro de uma categoria com faixas agrupadas.
-- Mantém as demais validações da inscrição existentes.
create or replace function public.validar_inscricao_competicao() returns trigger
language plpgsql set search_path=public as $$
declare c public.categorias_evento; q public.equipes_evento;
begin
  if new.categoria_id is not null then
    select * into c from public.categorias_evento where id=new.categoria_id;
    if c.id is null or c.evento_id<>new.evento_id or not c.ativa
      or new.idade is null or new.idade not between c.idade_min and c.idade_max
      or new.sexo is null or lower(trim(new.sexo))<>lower(trim(c.sexo))
      or new.faixa is null or not (
        lower(trim(c.faixa)) in ('todas', 'todas as faixas', 'todas faixas', 'livre')
        or exists (
          select 1 from regexp_split_to_table(c.faixa, '[,;/·]+') as faixa_permitida(valor)
          where lower(trim(faixa_permitida.valor)) = lower(trim(new.faixa))
        )
      ) then
      raise exception 'Inscrição incompatível com a categoria do evento.';
    end if;
    if c.tipo='peso' and (new.peso is null or trim(new.peso)='' or replace(new.peso,',','.')::numeric<=c.peso_min or (c.peso_max is not null and replace(new.peso,',','.')::numeric>c.peso_max)) then
      raise exception 'Peso incompatível com a categoria.';
    end if;
    new.modalidade:=c.modalidade;
  end if;
  if new.equipe_id is not null then
    select * into q from public.equipes_evento where id=new.equipe_id;
    if q.id is null or q.evento_id<>new.evento_id or not q.ativa then raise exception 'Equipe inválida para o evento.'; end if;
    new.equipe:=q.nome;
  end if;
  return new;
end $$;
