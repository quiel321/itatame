set lock_timeout = '3s';
alter table public.foto_eventos add column if not exists combo_ia_ativo boolean not null default false;
comment on column public.foto_eventos.combo_ia_ativo is 'Opt-in do responsável: pacote completo das fotos encontradas pela IA. Não inclui vídeos.';
