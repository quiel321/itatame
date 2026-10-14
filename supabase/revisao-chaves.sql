-- Produção: estrutura aditiva. Não altera cadastros, pagamentos ou resultados existentes.
begin;
create table if not exists public.chaves_publicacoes (
 categoria_id uuid primary key references public.categorias_evento(id) on delete cascade,
 evento_id uuid not null references public.eventos(id) on delete cascade,
 publicada boolean not null default false, revisao bigint not null default 1,
 publicada_em timestamptz, publicada_por uuid
);
create table if not exists public.chaves_revisoes (
 id bigint generated always as identity primary key, categoria_id uuid not null,
 evento_id uuid not null, operador uuid not null, realizada_em timestamptz not null default now(),
 acao text not null, motivo text, antes jsonb, depois jsonb
);
-- Chaves anteriores continuam divulgadas, inclusive as que já estão em operação.
insert into public.chaves_publicacoes(categoria_id,evento_id,publicada,publicada_em)
 select distinct categoria_id,evento_id,true,now() from public.chaves where categoria_id is not null
 on conflict do nothing;
alter table public.chaves_publicacoes enable row level security;
alter table public.chaves_revisoes enable row level security;
drop policy if exists publicacao_leitura on public.chaves_publicacoes;
create policy publicacao_leitura on public.chaves_publicacoes for select using(true);
drop policy if exists revisoes_organizador on public.chaves_revisoes;
create policy revisoes_organizador on public.chaves_revisoes for select using(exists(select 1 from public.eventos e where e.id=evento_id and e.organizador_id=auth.uid()));
grant select on public.chaves_publicacoes to anon,authenticated;
grant select on public.chaves_revisoes to authenticated;
grant all on public.chaves_publicacoes,public.chaves_revisoes to service_role;
-- RESTRICTIVE: também restringe a política pública já existente.
drop policy if exists chaves_somente_publicadas on public.chaves;
create policy chaves_somente_publicadas on public.chaves as restrictive for select to anon,authenticated
 using(exists(select 1 from public.chaves_publicacoes p where p.categoria_id=chaves.categoria_id and p.publicada)
 or exists(select 1 from public.eventos e where e.id=chaves.evento_id and e.organizador_id=auth.uid()));

create or replace function public.chaves_marcar_rascunho() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.categoria_id is null then raise exception 'A chave precisa de uma categoria vinculada para revisão.'; end if;
 perform 1 from public.categorias_evento where id=new.categoria_id for update;
 if public.chaves_categoria_travada(new.categoria_id) then raise exception 'Categoria já em operação. Não regenere suas chaves.'; end if;
 insert into public.chaves_publicacoes(categoria_id,evento_id) values(new.categoria_id,new.evento_id)
 on conflict(categoria_id) do update set publicada=false,revisao=chaves_publicacoes.revisao+1,publicada_em=null,publicada_por=null;
 return new;
end $$;
drop trigger if exists chaves_marcar_rascunho on public.chaves;
create trigger chaves_marcar_rascunho before insert on public.chaves for each row execute function public.chaves_marcar_rascunho();

-- Uma posição inicial nunca recebe vencedor/perdedor de outra luta.
create or replace function public.chaves_posicao_inicial(p_luta uuid,p_lado integer) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select p_lado in (1,2) and case
 when l.fase like '%Chave de 3%' or l.fase like '%Chave de 6%' then
   (l.id_visual in ('1','3') or (l.id_visual in ('2','4') and p_lado=2))
 else not exists(select 1 from public.chaves f where f.evento_id=l.evento_id and f.categoria_id=l.categoria_id
 and f.categoria is not distinct from l.categoria and f.faixa is not distinct from l.faixa
 and f.proxima_luta::text=l.id_visual and (case when f.id_visual::integer%2=1 then 1 else 2 end)=p_lado) end
 from public.chaves l where l.id=p_luta
$$;
create or replace function public.chaves_categoria_travada(p_categoria uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.recepcao_categorias where categoria_id=p_categoria and fechada)
 or exists(select 1 from public.chaves l where l.categoria_id=p_categoria and (
 l.iniciada_em is not null or l.status_luta='em_andamento'
 or (l.vencedor is not null and (l.atleta_1_id is not null or l.atleta_2_id is not null))
 or coalesce((l.pontuacao_atleta_1->>'chamador_presente')::boolean,false)
 or coalesce((l.pontuacao_atleta_2->>'chamador_presente')::boolean,false)
 or coalesce((l.pontuacao_atleta_1->>'chamador_chamadas')::integer,0)>0
 or coalesce((l.pontuacao_atleta_2->>'chamador_chamadas')::integer,0)>0
 or (l.atleta_1_id is not null and not public.chaves_posicao_inicial(l.id,1))
 or (l.atleta_2_id is not null and not public.chaves_posicao_inicial(l.id,2))))
$$;
create or replace function public.chaves_revisar(p_categoria uuid,p_revisao bigint,p_acao text,p_luta_a uuid default null,p_lado_a integer default null,p_luta_b uuid default null,p_lado_b integer default null,p_motivo text default null)
 returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare ev uuid; p public.chaves_publicacoes; a public.chaves; b public.chaves; x jsonb; y jsonb;
begin
 select evento_id into ev from public.categorias_evento where id=p_categoria for update;
 if ev is null or not exists(select 1 from public.eventos where id=ev and organizador_id=auth.uid()) then raise exception 'Somente o organizador deste evento pode revisar.'; end if;
 select * into p from public.chaves_publicacoes where categoria_id=p_categoria for update;
 if p.categoria_id is null or p.revisao<>p_revisao then raise exception 'As chaves mudaram. Atualize a revisão.'; end if;
 if public.chaves_categoria_travada(p_categoria) then raise exception 'Categoria já em operação. Não é possível alterar sua publicação ou posições.'; end if;
 if p_acao='revisar' then
  if not p.publicada then raise exception 'A categoria já está em revisão.'; end if;
  if length(trim(coalesce(p_motivo,'')))<3 then raise exception 'Informe o motivo para retirar da divulgação.'; end if;
  update public.chaves_publicacoes set publicada=false,revisao=revisao+1,publicada_em=null,publicada_por=null where categoria_id=p_categoria;
 elsif p_acao='publicar' then
  if p.publicada then raise exception 'Esta categoria já foi publicada.'; end if;
  if not exists(select 1 from public.chaves where categoria_id=p_categoria) then raise exception 'Gere as chaves antes de publicar.'; end if;
  if exists(select 1 from public.chaves l cross join lateral(values(1,l.atleta_1_id),(2,l.atleta_2_id)) s(lado,atleta)
    where l.categoria_id=p_categoria and s.atleta is not null and public.chaves_posicao_inicial(l.id,s.lado)
    group by l.categoria,l.faixa,s.atleta having count(*)>1) then raise exception 'Atleta repetido nas posições iniciais. Confira a chave.'; end if;
  if exists(select 1 from public.chaves l cross join lateral(values(1,l.atleta_1_id),(2,l.atleta_2_id)) s(lado,atleta)
    where l.categoria_id=p_categoria and s.atleta is not null and public.chaves_posicao_inicial(l.id,s.lado)
    and not exists(select 1 from public.inscricoes i where i.evento_id=ev and i.categoria_id=p_categoria and i.atleta_id=s.atleta and i.pagamento_ok and coalesce(i.estorno_status,'')<>'estornado')) then
    raise exception 'Há atleta sem inscrição ativa e pagamento confirmado. Confira antes de publicar.';
  end if;
  update public.chaves_publicacoes set publicada=true,revisao=revisao+1,publicada_em=now(),publicada_por=auth.uid() where categoria_id=p_categoria;
 elsif p_acao='trocar' then
  if p.publicada then raise exception 'Retire esta categoria da divulgação antes de trocar posições.'; end if;
  if p_lado_a not in (1,2) or p_lado_b not in (1,2) or p_lado_a is null or p_lado_b is null then raise exception 'Posição inválida.'; end if;
  if p_luta_a=p_luta_b and p_lado_a=p_lado_b then raise exception 'Escolha duas posições diferentes.'; end if;
  select * into a from public.chaves where id=p_luta_a and categoria_id=p_categoria for update;
  select * into b from public.chaves where id=p_luta_b and categoria_id=p_categoria for update;
  if a.id is null or b.id is null or a.categoria is distinct from b.categoria or a.faixa is distinct from b.faixa then raise exception 'Troque somente atletas da mesma divisão e faixa.'; end if;
  if not coalesce(public.chaves_posicao_inicial(a.id,p_lado_a),false) or not coalesce(public.chaves_posicao_inicial(b.id,p_lado_b),false) then raise exception 'Somente posições iniciais podem ser trocadas.'; end if;
  x=jsonb_build_object('nome',case p_lado_a when 1 then a.atleta_1 else a.atleta_2 end,'id',case p_lado_a when 1 then a.atleta_1_id else a.atleta_2_id end,'equipe',case p_lado_a when 1 then a.equipe_1 else a.equipe_2 end,'numero',case p_lado_a when 1 then a.numero_1 else a.numero_2 end);
  y=jsonb_build_object('nome',case p_lado_b when 1 then b.atleta_1 else b.atleta_2 end,'id',case p_lado_b when 1 then b.atleta_1_id else b.atleta_2_id end,'equipe',case p_lado_b when 1 then b.equipe_1 else b.equipe_2 end,'numero',case p_lado_b when 1 then b.numero_1 else b.numero_2 end);
  if x->>'id' is null or y->>'id' is null then raise exception 'Escolha dois atletas, sem vagas vazias.'; end if;
  if length(trim(coalesce(p_motivo,'')))<3 then raise exception 'Informe o motivo da troca.'; end if;
  update public.chaves set
   atleta_1=case when p_lado_a=1 then y->>'nome' else atleta_1 end,atleta_1_id=case when p_lado_a=1 then (y->>'id')::bigint else atleta_1_id end,equipe_1=case when p_lado_a=1 then y->>'equipe' else equipe_1 end,numero_1=case when p_lado_a=1 then y->>'numero' else numero_1 end,
   atleta_2=case when p_lado_a=2 then y->>'nome' else atleta_2 end,atleta_2_id=case when p_lado_a=2 then (y->>'id')::bigint else atleta_2_id end,equipe_2=case when p_lado_a=2 then y->>'equipe' else equipe_2 end,numero_2=case when p_lado_a=2 then y->>'numero' else numero_2 end where id=a.id;
  update public.chaves set
   atleta_1=case when p_lado_b=1 then x->>'nome' else atleta_1 end,atleta_1_id=case when p_lado_b=1 then (x->>'id')::bigint else atleta_1_id end,equipe_1=case when p_lado_b=1 then x->>'equipe' else equipe_1 end,numero_1=case when p_lado_b=1 then x->>'numero' else numero_1 end,
   atleta_2=case when p_lado_b=2 then x->>'nome' else atleta_2 end,atleta_2_id=case when p_lado_b=2 then (x->>'id')::bigint else atleta_2_id end,equipe_2=case when p_lado_b=2 then x->>'equipe' else equipe_2 end,numero_2=case when p_lado_b=2 then x->>'numero' else numero_2 end where id=b.id;
  update public.chaves_publicacoes set revisao=revisao+1 where categoria_id=p_categoria;
 else raise exception 'Ação inválida.'; end if;
 insert into public.chaves_revisoes(categoria_id,evento_id,operador,acao,motivo,antes,depois) values(p_categoria,ev,auth.uid(),p_acao,trim(p_motivo),jsonb_build_object('publicacao',to_jsonb(p),'a',x,'b',y),jsonb_build_object('a',y,'b',x,'luta_a',p_luta_a,'lado_a',p_lado_a,'luta_b',p_luta_b,'lado_b',p_lado_b));
 return jsonb_build_object('ok',true);
end $$;
create or replace function public.chaves_bloquear_despacho_rascunho() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform 1 from public.categorias_evento where id=new.categoria_id for update;
 if new.fechada and not exists(select 1 from public.chaves_publicacoes where categoria_id=new.categoria_id and publicada) then raise exception 'Publique as chaves desta categoria antes de fechar o check-in.'; end if;
 return new;
end $$;
drop trigger if exists chaves_bloquear_despacho_rascunho on public.recepcao_categorias;
create trigger chaves_bloquear_despacho_rascunho before insert or update on public.recepcao_categorias for each row execute function public.chaves_bloquear_despacho_rascunho();
revoke all on function public.chaves_revisar(uuid,bigint,text,uuid,integer,uuid,integer,text) from public;
grant execute on function public.chaves_revisar(uuid,bigint,text,uuid,integer,uuid,integer,text) to authenticated;
revoke all on function public.chaves_posicao_inicial(uuid,integer),public.chaves_categoria_travada(uuid),public.chaves_marcar_rascunho(),public.chaves_bloquear_despacho_rascunho() from public;
create or replace function public.chaves_revisao_listar(p_evento uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not exists(select 1 from public.eventos where id=p_evento and organizador_id=auth.uid()) then raise exception 'Acesso exclusivo do organizador do evento.'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('categoria_id',p.categoria_id,'nome',c.nome,'publicada',p.publicada,'revisao',p.revisao,'travada',public.chaves_categoria_travada(p.categoria_id),
 'posicoes',coalesce((select jsonb_agg(jsonb_build_object('luta',l.id,'lado',s.lado,'atleta',s.nome,'equipe',s.equipe,'divisao',l.categoria,'faixa',l.faixa,'ordem',l.ordem,'fase',l.fase,'peso',(select coalesce(i.peso_aferido::text,i.peso) from public.inscricoes i where i.evento_id=p_evento and i.categoria_id=p.categoria_id and i.atleta_id=s.atleta order by i.id desc limit 1)) order by l.ordem,s.lado)
 from public.chaves l cross join lateral(values(1,l.atleta_1_id,l.atleta_1,l.equipe_1),(2,l.atleta_2_id,l.atleta_2,l.equipe_2)) s(lado,atleta,nome,equipe)
 where l.categoria_id=p.categoria_id and s.atleta is not null and public.chaves_posicao_inicial(l.id,s.lado)),'[]'::jsonb)) order by c.nome)
 from public.chaves_publicacoes p join public.categorias_evento c on c.id=p.categoria_id where p.evento_id=p_evento),'[]'::jsonb);
end $$;
revoke all on function public.chaves_revisao_listar(uuid) from public;
grant execute on function public.chaves_revisao_listar(uuid) to authenticated;
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='chaves_publicacoes') then
  alter publication supabase_realtime add table public.chaves_publicacoes;
 end if;
end $$;
commit;
notify pgrst,'reload schema';

