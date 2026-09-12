-- Executar uma vez no SQL Editor do projeto. Não modifica inscrições ou chaves existentes.
begin;
alter table public.organizadores add column if not exists mp_parcelamento_comprador_confirmado boolean not null default false;

create table if not exists public.categorias_evento (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos(id),
  nome text not null, modalidade text not null, sexo text not null check (sexo in ('Masculino','Feminino')),
  faixa text not null, idade_min integer not null, idade_max integer not null,
  peso_min numeric not null default 0, peso_max numeric,
  tempo_minutos numeric not null check (tempo_minutos between 1 and 30),
  tipo text not null default 'peso' check (tipo in ('peso','absoluto')), ativa boolean not null default true,
  check (idade_min between 4 and 100 and idade_max between idade_min and 100),
  check (peso_min >= 0 and (peso_max is null or peso_max > peso_min))
);
create table if not exists public.equipes_evento (
  id uuid primary key default gen_random_uuid(), evento_id uuid not null references public.eventos(id),
  nome text not null check (length(trim(nome)) > 0), academia text not null default '',
  professor text not null default '', cidade text not null default '', ativa boolean not null default true
);
create unique index if not exists categorias_evento_unica on public.categorias_evento (
  evento_id, lower(trim(nome)), lower(trim(modalidade)), sexo, lower(trim(faixa)),
  idade_min, idade_max, peso_min, coalesce(peso_max, -1), tipo
);
create unique index if not exists equipes_evento_nome on public.equipes_evento(evento_id, lower(trim(nome)));
alter table public.inscricoes add column if not exists categoria_id uuid references public.categorias_evento(id);
alter table public.inscricoes add column if not exists equipe_id uuid references public.equipes_evento(id);
alter table public.chaves add column if not exists categoria_id uuid references public.categorias_evento(id);
alter table public.chaves add column if not exists tempo_minutos numeric;
create table if not exists public.resultados_manuais (
  id uuid primary key default gen_random_uuid(), luta_id uuid not null references public.chaves(id),
  organizador_id uuid not null, motivo text not null, vencedor_id bigint not null,
  criado_em timestamptz not null default now()
);
alter table public.categorias_evento enable row level security;
alter table public.equipes_evento enable row level security;
alter table public.resultados_manuais enable row level security;
drop policy if exists categorias_consulta on public.categorias_evento;
create policy categorias_consulta on public.categorias_evento for select to authenticated using (true);
drop policy if exists categorias_organizador on public.categorias_evento;
create policy categorias_organizador on public.categorias_evento for all to authenticated
  using (exists(select 1 from public.eventos e where e.id=evento_id and e.organizador_id=auth.uid()))
  with check (exists(select 1 from public.eventos e where e.id=evento_id and e.organizador_id=auth.uid()));
drop policy if exists equipes_consulta on public.equipes_evento;
create policy equipes_consulta on public.equipes_evento for select to authenticated using (true);
drop policy if exists equipes_organizador on public.equipes_evento;
create policy equipes_organizador on public.equipes_evento for all to authenticated
  using (exists(select 1 from public.eventos e where e.id=evento_id and e.organizador_id=auth.uid()))
  with check (exists(select 1 from public.eventos e where e.id=evento_id and e.organizador_id=auth.uid()));
drop policy if exists resultados_consulta on public.resultados_manuais;
create policy resultados_consulta on public.resultados_manuais for select to authenticated using (organizador_id=auth.uid());
grant select on public.categorias_evento,public.equipes_evento to authenticated;
grant insert,update,delete on public.categorias_evento,public.equipes_evento to authenticated;
grant select on public.resultados_manuais to authenticated;

create or replace function public.validar_inscricao_competicao() returns trigger
language plpgsql set search_path=public as $$
declare c public.categorias_evento; q public.equipes_evento;
begin
  if new.categoria_id is not null then
    select * into c from public.categorias_evento where id=new.categoria_id;
    if c.id is null or c.evento_id<>new.evento_id or not c.ativa
      or new.idade is null or new.idade not between c.idade_min and c.idade_max
      or new.sexo is null or lower(trim(new.sexo))<>lower(trim(c.sexo))
      or new.faixa is null or lower(trim(new.faixa))<>lower(trim(c.faixa)) then
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
drop trigger if exists validar_inscricao_competicao on public.inscricoes;
create trigger validar_inscricao_competicao before insert or update of categoria_id,equipe_id,idade,sexo,peso,faixa,evento_id on public.inscricoes
for each row execute function public.validar_inscricao_competicao();

-- Categorias utilizadas não mudam retroativamente.
create or replace function public.proteger_categoria_utilizada() returns trigger
language plpgsql set search_path=public as $$
begin
  if exists(select 1 from public.inscricoes where categoria_id=old.id) or exists(select 1 from public.chaves where categoria_id=old.id) then
    raise exception 'Categoria em uso. Crie outra categoria para preservar as inscrições existentes.';
  end if;
  return new;
end $$;
drop trigger if exists proteger_categoria_utilizada on public.categorias_evento;
create trigger proteger_categoria_utilizada before update on public.categorias_evento for each row execute function public.proteger_categoria_utilizada();

-- O endpoint autenticado prepara as lutas; a troca inteira ocorre em uma transação.
create or replace function public.substituir_chaves_evento(p_evento uuid,p_tipo text,p_lutas jsonb,p_organizador uuid) returns integer
language plpgsql security definer set search_path=public as $$
declare total integer;
begin
  perform 1 from public.eventos where id=p_evento and organizador_id=p_organizador for update;
  if not found then raise exception 'Evento não autorizado.'; end if;
  if p_tipo not in ('peso','absoluto') or jsonb_array_length(p_lutas)=0 then raise exception 'Chaveamento vazio ou inválido.'; end if;
  perform 1 from public.chaves where evento_id=p_evento for update;
  if exists(select 1 from public.chaves where evento_id=p_evento and (status_luta in ('em_andamento','concluida') or vencedor is not null or iniciada_em is not null)) then
    raise exception 'Evento com lutas iniciadas ou resultados. O chaveamento foi preservado.';
  end if;
  if exists(select 1 from jsonb_array_elements(p_lutas) x where x->>'evento_id' is distinct from p_evento::text) then raise exception 'Evento divergente.'; end if;
  delete from public.chaves where evento_id=p_evento and ((p_tipo='absoluto' and categoria ilike '%Absoluto%') or (p_tipo='peso' and categoria not ilike '%Absoluto%'));
  insert into public.chaves(evento_id,categoria,faixa,categoria_id,tempo_minutos,id_visual,atleta_1,equipe_1,numero_1,atleta_1_id,atleta_2,equipe_2,numero_2,atleta_2_id,fase,ordem,lado,proxima_luta,status_luta,pontuacao_atleta_1,pontuacao_atleta_2)
  select evento_id,categoria,faixa,categoria_id,tempo_minutos,id_visual,atleta_1,equipe_1,numero_1,atleta_1_id,atleta_2,equipe_2,numero_2,atleta_2_id,fase,ordem,lado,proxima_luta,'agendada',pontuacao_atleta_1,pontuacao_atleta_2
  from jsonb_populate_recordset(null::public.chaves,p_lutas);
  get diagnostics total=row_count;
  return total;
end $$;
revoke all on function public.substituir_chaves_evento(uuid,text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.substituir_chaves_evento(uuid,text,jsonb,uuid) to service_role;

create or replace function public.registrar_resultado_manual(p_luta uuid,p_vencedor bigint,p_atleta1 bigint,p_atleta2 bigint,p_metodo text,p_motivo text) returns void
language plpgsql security definer set search_path=public as $$
declare l public.chaves; prox public.chaves; nome_v text; equipe_v text; perdedor bigint; lado integer;
begin
  select * into l from public.chaves where id=p_luta;
  perform 1 from public.eventos where id=l.evento_id and organizador_id=auth.uid() for update;
  if not found then raise exception 'Evento não autorizado.'; end if;
  perform 1 from public.chaves where evento_id=l.evento_id and categoria=l.categoria and faixa=l.faixa for update;
  select * into l from public.chaves where id=p_luta;
  if l.atleta_1_id is distinct from p_atleta1 or l.atleta_2_id is distinct from p_atleta2 then raise exception 'Os atletas mudaram. Atualize antes de registrar.'; end if;
  if l.vencedor_id=p_vencedor and l.status_luta='concluida' then return; end if;
  if l.status_luta='concluida' or l.vencedor is not null then raise exception 'Resultado já registrado. Não será sobrescrito.'; end if;
  if l.status_luta='em_andamento' then raise exception 'Encerre a operação do placar antes do lançamento manual.'; end if;
  if p_vencedor is null or (p_vencedor is distinct from l.atleta_1_id and p_vencedor is distinct from l.atleta_2_id) then raise exception 'Vencedor inválido.'; end if;
  if p_metodo not in ('pontos','vantagens','finalizacao','decisao','desclassificacao','wo') or length(trim(p_motivo))<5 then raise exception 'Informe método e justificativa.'; end if;
  if exists(select 1 from public.chaves c where c.evento_id=l.evento_id and c.categoria=l.categoria and c.faixa=l.faixa and (c.proxima_luta::text=l.id_visual or (l.fase ilike '%Chave de 3%' and l.id_visual='2' and c.id_visual='1')) and c.status_luta<>'concluida') then raise exception 'Há luta anterior pendente.'; end if;
  if (l.atleta_1_id is null or l.atleta_2_id is null) and p_metodo<>'wo' then raise exception 'Sem dois atletas, somente W.O. pode ser registrado.'; end if;
  if p_vencedor=l.atleta_1_id then nome_v:=l.atleta_1; equipe_v:=l.equipe_1; perdedor:=l.atleta_2_id; else nome_v:=l.atleta_2; equipe_v:=l.equipe_2; perdedor:=l.atleta_1_id; end if;
  if l.proxima_luta is not null then
    select * into prox from public.chaves where evento_id=l.evento_id and categoria=l.categoria and faixa=l.faixa and id_visual=l.proxima_luta::text;
    if not found then raise exception 'Próxima luta não encontrada.'; end if;
    if prox.status_luta in ('em_andamento','concluida') or prox.vencedor is not null then raise exception 'A próxima luta já iniciou.'; end if;
    lado:=l.id_visual::integer%2;
    if lado=1 then update public.chaves set atleta_1=nome_v,equipe_1=equipe_v,atleta_1_id=p_vencedor where id=prox.id;
    else update public.chaves set atleta_2=nome_v,equipe_2=equipe_v,atleta_2_id=p_vencedor where id=prox.id; end if;
  end if;
  if l.fase ilike '%Chave de 3%' and l.id_visual='1' then
    select * into prox from public.chaves where evento_id=l.evento_id and categoria=l.categoria and faixa=l.faixa and id_visual='2';
    if not found or prox.status_luta in ('em_andamento','concluida') then raise exception 'Segunda semifinal indisponível.'; end if;
    update public.chaves set atleta_1=case when p_vencedor=l.atleta_1_id then l.atleta_2 else l.atleta_1 end,
      equipe_1=case when p_vencedor=l.atleta_1_id then l.equipe_2 else l.equipe_1 end,atleta_1_id=perdedor where id=prox.id;
  end if;
  update public.chaves set vencedor=nome_v,vencedor_id=p_vencedor,status_luta='concluida',metodo_vitoria=p_metodo::public.metodo_vitoria_tipo,finalizada_em=now() where id=l.id;
  if l.proxima_luta is null then
    update public.atletas set ouro=coalesce(ouro,0)+1 where id=p_vencedor;
    update public.atletas set prata=coalesce(prata,0)+1 where id=perdedor;
  elsif l.proxima_luta=999 and not (l.fase ilike '%Chave de 3%' and l.id_visual='1') then
    update public.atletas set bronze=coalesce(bronze,0)+1 where id=perdedor;
  end if;
  if p_metodo='wo' then update public.atletas set vitorias_wo=coalesce(vitorias_wo,0)+1 where id=p_vencedor; end if;
  insert into public.resultados_manuais(luta_id,organizador_id,motivo,vencedor_id) values(l.id,auth.uid(),trim(p_motivo),p_vencedor);
end $$;
revoke all on function public.registrar_resultado_manual(uuid,bigint,bigint,bigint,text,text) from public,anon;
grant execute on function public.registrar_resultado_manual(uuid,bigint,bigint,bigint,text,text) to authenticated;
create or replace function public.unificar_equipes_evento(p_evento uuid,p_destino uuid,p_nomes text[]) returns integer
language plpgsql security definer set search_path=public as $$
declare destino public.equipes_evento; total integer;
begin
  perform 1 from public.eventos where id=p_evento and organizador_id=auth.uid() for update;
  if not found then raise exception 'Evento não autorizado.'; end if;
  if coalesce(array_length(p_nomes,1),0)=0 then raise exception 'Selecione os nomes para unificar.'; end if;
  if exists(select 1 from public.chaves where evento_id=p_evento) then raise exception 'Unifique antes de gerar as chaves para preservar o sorteio e o ranking.'; end if;
  select * into destino from public.equipes_evento where id=p_destino and evento_id=p_evento and ativa;
  if not found then raise exception 'Equipe de destino inválida.'; end if;
  update public.inscricoes set equipe_id=destino.id,equipe=destino.nome where evento_id=p_evento and equipe=any(p_nomes);
  get diagnostics total=row_count;
  return total;
end $$;
revoke all on function public.unificar_equipes_evento(uuid,uuid,text[]) from public,anon;
grant execute on function public.unificar_equipes_evento(uuid,uuid,text[]) to authenticated;

create table if not exists public.solicitacoes_equipe_evento (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos(id),
  professor_user_id uuid not null,
  equipe_nome text not null check (length(trim(equipe_nome)) > 0),
  academia text not null default '',
  professor text not null check (length(trim(professor)) > 0),
  cidade text not null default '',
  status text not null default 'pendente' check (status in ('pendente','aprovada','recusada')),
  equipe_id uuid references public.equipes_evento(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (evento_id, professor_user_id)
);
alter table public.solicitacoes_equipe_evento enable row level security;
drop policy if exists solicitacoes_consulta on public.solicitacoes_equipe_evento;
create policy solicitacoes_consulta on public.solicitacoes_equipe_evento for select to authenticated using (
  professor_user_id=auth.uid() or exists(select 1 from public.eventos e where e.id=evento_id and e.organizador_id=auth.uid())
);
drop policy if exists solicitacoes_professor_insere on public.solicitacoes_equipe_evento;
create policy solicitacoes_professor_insere on public.solicitacoes_equipe_evento for insert to authenticated with check (
  professor_user_id=auth.uid() and status='pendente'
  and exists(select 1 from public.atletas a where a.user_id=auth.uid()::text and a.role='professor')
);
drop policy if exists solicitacoes_professor_atualiza on public.solicitacoes_equipe_evento;
create policy solicitacoes_professor_atualiza on public.solicitacoes_equipe_evento for update to authenticated
  using (professor_user_id=auth.uid() and status in ('pendente','recusada'))
  with check (professor_user_id=auth.uid() and status='pendente' and equipe_id is null);
drop policy if exists solicitacoes_organizador on public.solicitacoes_equipe_evento;
create policy solicitacoes_organizador on public.solicitacoes_equipe_evento for update to authenticated
  using (exists(select 1 from public.eventos e where e.id=evento_id and e.organizador_id=auth.uid()))
  with check (exists(select 1 from public.eventos e where e.id=evento_id and e.organizador_id=auth.uid()));
grant select,insert,update on public.solicitacoes_equipe_evento to authenticated;

create or replace function public.aprovar_solicitacao_equipe_evento(p_solicitacao uuid) returns uuid
language plpgsql security definer set search_path=public as $$
declare s public.solicitacoes_equipe_evento; equipe uuid;
begin
  select * into s from public.solicitacoes_equipe_evento where id=p_solicitacao for update;
  if not found then raise exception 'Solicitação não encontrada.'; end if;
  perform 1 from public.eventos where id=s.evento_id and organizador_id=auth.uid();
  if not found then raise exception 'Evento não autorizado.'; end if;
  if s.status='aprovada' and s.equipe_id is not null then return s.equipe_id; end if;
  select id into equipe from public.equipes_evento where evento_id=s.evento_id and lower(trim(nome))=lower(trim(s.equipe_nome)) limit 1;
  if equipe is null then
    insert into public.equipes_evento(evento_id,nome,academia,professor,cidade)
    values(s.evento_id,trim(s.equipe_nome),trim(s.academia),trim(s.professor),trim(s.cidade)) returning id into equipe;
  end if;
  update public.solicitacoes_equipe_evento set status='aprovada',equipe_id=equipe,atualizado_em=now() where id=s.id;
  return equipe;
end $$;
revoke all on function public.aprovar_solicitacao_equipe_evento(uuid) from public,anon;
grant execute on function public.aprovar_solicitacao_equipe_evento(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
