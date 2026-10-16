-- Estrutura aditiva. Nenhum envio, backfill ou alteração em inscrições/lutas/assinaturas existentes.
begin;
create table if not exists public.push_dispositivos (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),
 endpoint text not null,subscription jsonb not null,atualizada_em timestamptz not null default now(),
 unique(user_id,endpoint),check(subscription->>'endpoint'=endpoint),check(length(endpoint)<2048)
);
alter table public.push_dispositivos enable row level security;
revoke all on public.push_dispositivos from public,anon;
grant select,insert,update on public.push_dispositivos to authenticated;
grant all on public.push_dispositivos to service_role;
drop policy if exists push_dispositivos_proprios on public.push_dispositivos;
create policy push_dispositivos_proprios on public.push_dispositivos for all to authenticated using(user_id=(select auth.uid()) and coalesce((select auth.jwt())->>'is_anonymous','false')='false') with check(user_id=(select auth.uid()) and coalesce((select auth.jwt())->>'is_anonymous','false')='false');
create table if not exists public.push_fila (
 id uuid primary key default gen_random_uuid(),evento_id uuid not null references public.eventos(id),
 atleta_id bigint not null references public.atletas(id),luta_id uuid references public.chaves(id),
 chave text not null unique,tipo text not null,titulo text not null,mensagem text not null,url text not null,
 criada_em timestamptz not null default now(),expira_em timestamptz not null,
 estado text not null default 'pendente' check(estado in ('pendente','processando','enviado','sem_assinatura','expirado','falha')),
 tentativas integer not null default 0,proxima_em timestamptz not null default now(),trava_ate timestamptz,
 enviados integer not null default 0,erro text,finalizada_em timestamptz
);
create index if not exists push_fila_pendentes on public.push_fila(evento_id,proxima_em) where estado in ('pendente','processando');
create index if not exists push_fila_evento on public.push_fila(evento_id);
create index if not exists push_fila_atleta on public.push_fila(atleta_id);
create index if not exists push_fila_luta on public.push_fila(luta_id);
create table if not exists public.push_entregas (
 aviso_id uuid not null references public.push_fila(id),endpoint_hash text not null,
 estado text not null check(estado in ('enviado','invalido')),realizada_em timestamptz not null default now(),
 primary key(aviso_id,endpoint_hash)
);
alter table public.push_fila enable row level security;
alter table public.push_entregas enable row level security;
revoke all on public.push_fila,public.push_entregas from public,anon,authenticated;
grant all on public.push_fila,public.push_entregas to service_role;
do $policies$ begin
if not exists(select 1 from pg_policies where schemaname='public' and tablename='push_fila' and policyname='push_fila_servidor') then create policy push_fila_servidor on public.push_fila for all to service_role using(true) with check(true);end if;
if not exists(select 1 from pg_policies where schemaname='public' and tablename='push_entregas' and policyname='push_entregas_servidor') then create policy push_entregas_servidor on public.push_entregas for all to service_role using(true) with check(true);end if;
end $policies$;
create or replace function public.push_reivindicar(p_evento uuid,p_limite integer default 5)
returns setof public.push_fila language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 update public.push_fila set estado='expirado',finalizada_em=now() where evento_id=p_evento and estado in ('pendente','processando') and expira_em<=now();
 return query with candidatas as (
 select id from public.push_fila where evento_id=p_evento and expira_em>now() and proxima_em<=now()
 and (estado='pendente' or (estado='processando' and trava_ate<now())) order by criada_em,id limit greatest(1,least(5,p_limite)) for update skip locked
 ) update public.push_fila f set estado='processando',tentativas=f.tentativas+1,trava_ate=now()+interval '2 minutes'
 from candidatas c where f.id=c.id returning f.*;
end $$;
revoke all on function public.push_reivindicar(uuid,integer) from public,anon,authenticated;
grant execute on function public.push_reivindicar(uuid,integer) to service_role;
-- O recibo da operação protege também a intenção do push; recuperar uma resposta não duplica avisos.
create or replace function public.push_enfileirar_operacao()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
declare l public.chaves;i public.inscricoes;aid bigint;nom text;ti text;msg text;prazo interval:=interval '5 minutes';numero integer;
begin
 if new.criada_em<now()-interval '1 minute' then return new;end if;
 if new.tipo='checkin' and new.resposta->>'status'='aprovado' and new.pedido->'dados'->>'estado_anterior' is distinct from 'aprovado' then
  select * into i from public.inscricoes where id=new.alvo::bigint and evento_id=new.evento_id;
  if i.atleta_id is not null then
   insert into public.push_fila(evento_id,atleta_id,chave,tipo,titulo,mensagem,url,expira_em)
   values(new.evento_id,i.atleta_id,new.id::text||':checkin','checkin','Check-in aprovado',coalesce(i.atleta,'Atleta')||': check-in aprovado. Acompanhe o painel ao vivo e aguarde a chamada.','/evento/'||new.evento_id||'/ao-vivo',now()+interval '30 minutes') on conflict(chave) do nothing;
  end if;return new;
 end if;
 if new.tipo not in ('controle','chamar','iniciar') then return new;end if;
 select * into l from public.chaves where id=new.alvo::uuid and evento_id=new.evento_id;
 if not found then return new;end if;
 if new.tipo='controle' then
  if new.pedido->'dados'->>'acao' is distinct from 'chamada' then return new;end if;
  if (new.pedido->'dados'->>'lado')::integer=1 then aid:=l.atleta_1_id;nom:=l.atleta_1;numero:=coalesce((l.pontuacao_atleta_1->>'chamador_chamadas')::integer,1);
  else aid:=l.atleta_2_id;nom:=l.atleta_2;numero:=coalesce((l.pontuacao_atleta_2->>'chamador_chamadas')::integer,1);end if;
  ti:=numero||'ª chamada';msg:=coalesce(nom,'Atleta')||': apresente-se ao chamador para '||coalesce(l.categoria,'sua categoria')||'. '||coalesce(l.tatame,'Confira o tatame no painel')||'.';
  if aid is not null then insert into public.push_fila(evento_id,atleta_id,luta_id,chave,tipo,titulo,mensagem,url,expira_em) values(new.evento_id,aid,l.id,new.id::text||':'||aid,'chamada',ti,msg,'/evento/'||new.evento_id||'/ao-vivo',now()+prazo) on conflict(chave) do nothing;end if;
 elsif new.tipo='chamar' or (new.tipo='iniciar' and coalesce(new.pedido->'base'->>'iniciada_em','')='') then
  for aid,nom in select l.atleta_1_id,l.atleta_1 union all select l.atleta_2_id,l.atleta_2 loop
   if aid is null then continue;end if;
   insert into public.push_fila(evento_id,atleta_id,luta_id,chave,tipo,titulo,mensagem,url,expira_em)
   values(new.evento_id,aid,l.id,new.id::text||':'||aid,'tatame','Sua luta foi chamada',coalesce(nom,'Atleta')||': sua luta está liberada. Compareça ao '||coalesce(l.tatame,'tatame indicado no painel')||'.','/evento/'||new.evento_id||'/ao-vivo',now()+prazo) on conflict(chave) do nothing;
  end loop;
 end if;return new;
end $$;
revoke all on function public.push_enfileirar_operacao() from public,anon,authenticated;
drop trigger if exists push_enfileirar_operacao on public.operacao_confirmacoes;
create trigger push_enfileirar_operacao after insert on public.operacao_confirmacoes for each row execute function public.push_enfileirar_operacao();
notify pgrst,'reload schema';
commit;
