-- Logos leves (WebP) da equipe e da academia/unidade.
alter table public.equipes_evento add column if not exists logo_url text;
alter table public.equipes_evento add column if not exists academia_logo_url text;
alter table public.solicitacoes_equipe_evento add column if not exists logo_url text;
