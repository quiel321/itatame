-- Executar uma vez no SQL Editor. Dá identidade de banco ao posto de operação (check-in, chamador, mesário)
-- e restringe a edição de atletas ao evento daquele posto. Não altera inscrições, chaves nem resultados.
-- A policy aberta "Update Autenticado" de public.atletas continua valendo aqui: ela é derrubada em
-- supabase/staff_identidade_rls_fechamento.sql, depois que o posto novo estiver em produção.
begin;

-- O login do staff cria uma sessão anônima (auth.signInAnonymously). Esta tabela é o que liga
-- aquela sessão ao PIN de staff_eventos; sem ela o Postgres não distingue um mesário de um visitante.
create table if not exists public.staff_sessoes (
  auth_user_id uuid primary key,
  staff_evento_id uuid not null references public.staff_eventos(id) on delete cascade,
  evento_id uuid not null references public.eventos(id),
  funcao text not null,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null default now() + interval '24 hours'
);
create index if not exists staff_sessoes_evento on public.staff_sessoes(evento_id, expira_em);
alter table public.staff_sessoes enable row level security;
-- Sem policy e sem grant: o vínculo só é escrito e lido pelas funções security definer abaixo.
revoke all on public.staff_sessoes from anon, authenticated;

-- PIN validado dentro do banco: o posto deixa de precisar ler staff_eventos para entrar.
create or replace function public.vincular_sessao_staff(p_pin text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare s public.staff_eventos; e public.eventos; encontrados integer;
begin
  if auth.uid() is null then raise exception 'Sessão ausente. Refaça a entrada no posto.'; end if;
  select count(*) into encontrados from public.staff_eventos where upper(trim(pin_acesso))=upper(trim(p_pin));
  if encontrados=0 then raise exception 'Código inválido ou não encontrado.'; end if;
  if encontrados>1 then raise exception 'Este código está repetido em mais de um posto. Peça ao organizador um PIN exclusivo.'; end if;
  select * into s from public.staff_eventos where upper(trim(pin_acesso))=upper(trim(p_pin));
  select * into e from public.eventos where id=s.evento_id;
  if e.id is null then raise exception 'O campeonato deste posto não existe mais.'; end if;
  insert into public.staff_sessoes(auth_user_id,staff_evento_id,evento_id,funcao)
  values(auth.uid(),s.id,s.evento_id,s.funcao)
  on conflict (auth_user_id) do update set staff_evento_id=excluded.staff_evento_id,
    evento_id=excluded.evento_id, funcao=excluded.funcao, expira_em=now()+interval '24 hours';
  return jsonb_build_object(
    'staff_id',s.id,'evento_id',s.evento_id,'funcao',s.funcao,'identificacao',s.identificacao,
    'evento_nome',e.nome,
    'plano_comercial',(select o.plano_comercial from public.organizadores o where o.user_id=e.organizador_id limit 1)
  );
end $$;
revoke all on function public.vincular_sessao_staff(text) from public,anon;
grant execute on function public.vincular_sessao_staff(text) to authenticated;

-- O evento do posto vem por função definer porque staff_sessoes não é legível pelo cliente.
create or replace function public.staff_sessao_evento() returns uuid
language sql stable security definer set search_path=public as $$
  select s.evento_id from public.staff_sessoes s
  where s.auth_user_id=auth.uid() and s.expira_em>now() limit 1;
$$;
revoke all on function public.staff_sessao_evento() from public,anon;
grant execute on function public.staff_sessao_evento() to authenticated;

-- Check-in grava peso por user_id e o placar grava medalhas por id: a checagem cobre os dois caminhos.
-- Inscrição de dependente pode guardar o user_id do responsável, por isso atleta_id também é comparado.
create or replace function public.staff_pode_editar_atleta(p_atleta_id bigint, p_atleta_user_id text)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.staff_sessoes s
    join public.inscricoes i on i.evento_id=s.evento_id
    where s.auth_user_id=auth.uid() and s.expira_em>now()
      and (i.atleta_id=p_atleta_id or i.user_id=p_atleta_user_id)
  );
$$;
revoke all on function public.staff_pode_editar_atleta(bigint,text) from public,anon;
grant execute on function public.staff_pode_editar_atleta(bigint,text) to authenticated;

-- Escopo de linha: o posto alcança apenas atletas inscritos no evento dele. Postgres não limita
-- coluna em policy, então peso e medalhas ficam liberados juntos para esse conjunto de atletas.
drop policy if exists staff_atualiza_atleta_do_evento on public.atletas;
create policy staff_atualiza_atleta_do_evento on public.atletas for update to authenticated
  using (public.staff_pode_editar_atleta(id,user_id))
  with check (public.staff_pode_editar_atleta(id,user_id));

-- PIN deixa de ser público: hoje qualquer um com a anon key lê staff_eventos e assume um posto.
drop policy if exists "Leitura Publica" on public.staff_eventos;
drop policy if exists "Insercao Autenticada" on public.staff_eventos;
drop policy if exists "Update Autenticado" on public.staff_eventos;
drop policy if exists "Exclusao Autenticada" on public.staff_eventos;
drop policy if exists staff_eventos_organizador on public.staff_eventos;
create policy staff_eventos_organizador on public.staff_eventos for all to authenticated
  using (exists(select 1 from public.eventos e where e.id=evento_id and e.organizador_id=auth.uid()))
  with check (exists(select 1 from public.eventos e where e.id=evento_id and e.organizador_id=auth.uid()));
-- O painel do mesário lista os tatames e o chamador do próprio evento.
drop policy if exists staff_eventos_posto on public.staff_eventos;
create policy staff_eventos_posto on public.staff_eventos for select to authenticated
  using (evento_id=public.staff_sessao_evento());

notify pgrst,'reload schema';
commit;
