alter table public.foto_eventos
  add column if not exists descontos_progressivos jsonb,
  add column if not exists em_breve boolean not null default false;

alter table public.foto_eventos
  drop constraint if exists foto_eventos_descontos_progressivos_validos;
alter table public.foto_eventos
  add constraint foto_eventos_descontos_progressivos_validos
  check (descontos_progressivos is null or jsonb_typeof(descontos_progressivos) = 'array');

create index if not exists foto_eventos_publicados_em_breve_idx
  on public.foto_eventos (em_breve, data_evento desc)
  where status = 'publicado';
