-- Execute antes de publicar a interface de categorias e colaboração.
alter table public.foto_eventos
  add column if not exists categoria text not null default 'outros-eventos';

update public.foto_eventos
set categoria = 'jiu-jitsu'
where categoria = 'outros-eventos'
  and (nome ~* 'jiu.?jitsu|tatame|campeonato.*spartan');
update public.foto_eventos set categoria = 'corrida'
where categoria = 'outros-eventos' and nome ~* 'corrida|maratona|meia maratona|run';
update public.foto_eventos set categoria = 'ciclismo'
where categoria = 'outros-eventos' and nome ~* 'ciclismo|pedal|bike';
update public.foto_eventos set categoria = 'futebol'
where categoria = 'outros-eventos' and nome ~* 'futebol|society|futsal';
update public.foto_eventos set categoria = 'automobilismo'
where categoria = 'outros-eventos' and nome ~* 'automobilismo|kart|motocross|rally';

alter table public.foto_eventos
  drop constraint if exists foto_eventos_categoria_check;
alter table public.foto_eventos
  add constraint foto_eventos_categoria_check check (categoria in (
    'jiu-jitsu', 'corrida', 'ciclismo', 'futebol', 'automobilismo',
    'outros-esportes', 'casamento', 'formatura', 'show', 'corporativo', 'outros-eventos'
  ));
create index if not exists foto_eventos_categoria_publicada_idx
  on public.foto_eventos (categoria, data_evento desc)
  where status = 'publicado' and acesso_por_link = false;

-- Um fotógrafo credenciado lê apenas o evento e os álbuns onde pode publicar.
create or replace function public.foto_colaborador_ativo(p_evento uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.foto_evento_fotografos ef
    join public.fotografos f on f.id = ef.fotografo_id
    where ef.evento_id = p_evento and ef.status = 'ativo' and f.user_id = (select auth.uid())
  );
$$;
revoke all on function public.foto_colaborador_ativo(uuid) from public;
grant execute on function public.foto_colaborador_ativo(uuid) to authenticated;
drop policy if exists foto_eventos_colaborador_select on public.foto_eventos;
create policy foto_eventos_colaborador_select on public.foto_eventos
  for select to authenticated using (public.foto_colaborador_ativo(id));
drop policy if exists foto_albuns_colaborador_select on public.foto_albuns;
create policy foto_albuns_colaborador_select on public.foto_albuns
  for select to authenticated using (public.foto_colaborador_ativo(evento_id));
