-- Mantém a validação normal para inscrições e libera apenas a exceção
-- auditada pelo serviço do organizador ao mudar a categoria oficial.
create or replace function public.validar_inscricao_competicao() returns trigger
language plpgsql set search_path=public as $$
declare
  c public.categorias_evento;
  q public.equipes_evento;
  idade_fora boolean;
  peso_fora boolean;
  faixa_fora boolean;
  ajuste_novo boolean := false;
  ajuste_existente boolean := false;
begin
  if new.categoria_id is not null then
    select * into c from public.categorias_evento where id=new.categoria_id;
    if c.id is null or c.evento_id<>new.evento_id or not c.ativa
      or new.sexo is null or lower(trim(new.sexo))<>lower(trim(c.sexo)) then
      raise exception 'Inscrição incompatível com a categoria do evento.';
    end if;

    idade_fora := new.idade is null or new.idade not between c.idade_min and c.idade_max;
    faixa_fora := new.faixa is null or not (
      lower(trim(c.faixa)) in ('todas', 'todas as faixas', 'todas faixas', 'livre')
      or exists (
        select 1 from regexp_split_to_table(c.faixa, '[,;/·]+') as faixa_permitida(valor)
        where lower(trim(faixa_permitida.valor))=lower(trim(new.faixa))
      )
    );
    peso_fora := c.tipo='peso' and (
      new.peso is null or trim(new.peso)='' or
      replace(new.peso,',','.')::numeric<=c.peso_min or
      (c.peso_max is not null and replace(new.peso,',','.')::numeric>c.peso_max)
    );

    if tg_op='UPDATE' then
      -- Uma exceção anterior continua válida quando se editam outros dados.
      ajuste_existente := old.categoria_id is not distinct from new.categoria_id
        and old.evento_id=new.evento_id
        and old.categoria_ajuste_por is not null
        and old.categoria_ajuste_motivo is not null
        and old.categoria_ajuste_em is not null
        and old.categoria_ajuste_por is not distinct from new.categoria_ajuste_por
        and old.categoria_ajuste_motivo is not distinct from new.categoria_ajuste_motivo
        and old.categoria_ajuste_em is not distinct from new.categoria_ajuste_em
        and exists (
          select 1 from public.eventos e
          where e.id=new.evento_id and e.organizador_id=old.categoria_ajuste_por
        );

      -- A primeira exceção exige serviço, organizador real, justificativa e
      -- campeonato ainda sem chaves. A regra de sexo segue acima.
      ajuste_novo := c.tipo='peso'
        and old.categoria_id is distinct from new.categoria_id
        and coalesce(auth.role(),'')='service_role'
        and new.categoria_ajuste_por is not null
        and length(trim(coalesce(new.categoria_ajuste_motivo,''))) between 10 and 500
        and new.categoria_ajuste_em is not null
        and exists (
          select 1 from public.eventos e
          where e.id=new.evento_id and e.organizador_id=new.categoria_ajuste_por
        )
        and not exists (select 1 from public.chaves ch where ch.evento_id=new.evento_id);
    end if;

    if (idade_fora or peso_fora or faixa_fora) and not (ajuste_novo or ajuste_existente) then
      raise exception 'Idade, peso ou faixa incompatível com a categoria. Use o ajuste justificado do organizador.';
    end if;
    new.modalidade:=c.modalidade;
  end if;

  if new.equipe_id is not null then
    select * into q from public.equipes_evento where id=new.equipe_id;
    if q.id is null or q.evento_id<>new.evento_id or not q.ativa then
      raise exception 'Equipe inválida para o evento.';
    end if;
    new.equipe:=q.nome;
  end if;
  return new;
end $$;

-- O atleta não pode forjar a auditoria antes de tentar uma troca direta.
create or replace function public.proteger_auditoria_categoria_organizador() returns trigger
language plpgsql set search_path=public as $$
begin
  if tg_op='INSERT' then
    if (new.categoria_ajuste_motivo is not null
      or new.categoria_ajuste_por is not null
      or new.categoria_ajuste_em is not null)
      and coalesce(auth.role(),'')<>'service_role' then
      raise exception 'A auditoria de categoria só pode ser definida pelo serviço do organizador.';
    end if;
    return new;
  end if;
  if (new.categoria_ajuste_motivo is distinct from old.categoria_ajuste_motivo
    or new.categoria_ajuste_por is distinct from old.categoria_ajuste_por
    or new.categoria_ajuste_em is distinct from old.categoria_ajuste_em)
    and coalesce(auth.role(),'')<>'service_role' then
    raise exception 'A auditoria de categoria só pode ser alterada pelo serviço do organizador.';
  end if;
  return new;
end $$;

drop trigger if exists proteger_auditoria_categoria_organizador on public.inscricoes;
create trigger proteger_auditoria_categoria_organizador
before update of categoria_ajuste_motivo,categoria_ajuste_por,categoria_ajuste_em
on public.inscricoes for each row
execute function public.proteger_auditoria_categoria_organizador();

drop trigger if exists proteger_auditoria_categoria_na_insercao on public.inscricoes;
create trigger proteger_auditoria_categoria_na_insercao
before insert on public.inscricoes for each row
execute function public.proteger_auditoria_categoria_organizador();
