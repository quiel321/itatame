-- Chat interno por evento: atleta inscrito conversa com o organizador.
begin;

create table if not exists public.mensagens_evento (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos(id) on delete cascade,
  atleta_user_id text not null,
  remetente text not null check (remetente in ('atleta','organizador')),
  texto text not null check (char_length(trim(texto)) between 1 and 2000),
  lida boolean not null default false,
  criado_em timestamptz not null default now()
);
create index if not exists mensagens_evento_thread on public.mensagens_evento (evento_id, atleta_user_id, criado_em);
create index if not exists mensagens_evento_nao_lidas on public.mensagens_evento (evento_id, remetente, lida);

alter table public.mensagens_evento enable row level security;

drop policy if exists mensagens_evento_select on public.mensagens_evento;
create policy mensagens_evento_select on public.mensagens_evento for select to authenticated using (
  atleta_user_id = auth.uid()::text
  or exists (select 1 from public.eventos e where e.id = evento_id and e.organizador_id = auth.uid())
  or exists (
    select 1 from public.atletas a
    where a.user_id = mensagens_evento.atleta_user_id
      and a.responsavel_id = auth.uid()
  )
);

drop policy if exists mensagens_evento_insert on public.mensagens_evento;
create policy mensagens_evento_insert on public.mensagens_evento for insert to authenticated with check (
  (
    remetente = 'atleta'
    and atleta_user_id = auth.uid()::text
    and exists (
      select 1 from public.inscricoes i
      where i.evento_id = mensagens_evento.evento_id
        and (i.user_id = auth.uid()::text or i.user_id = auth.uid()::uuid::text)
    )
  )
  or (
    remetente = 'organizador'
    and exists (select 1 from public.eventos e where e.id = evento_id and e.organizador_id = auth.uid())
  )
);

drop policy if exists mensagens_evento_update on public.mensagens_evento;
create policy mensagens_evento_update on public.mensagens_evento for update to authenticated
  using (
    atleta_user_id = auth.uid()::text
    or exists (select 1 from public.eventos e where e.id = evento_id and e.organizador_id = auth.uid())
  )
  with check (
    atleta_user_id = auth.uid()::text
    or exists (select 1 from public.eventos e where e.id = evento_id and e.organizador_id = auth.uid())
  );

grant select, insert, update on public.mensagens_evento to authenticated;

notify pgrst, 'reload schema';
commit;
