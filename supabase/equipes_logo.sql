-- Logos leves (WebP) da equipe e da academia/unidade.
alter table public.equipes_evento add column if not exists logo_url text;
alter table public.equipes_evento add column if not exists academia_logo_url text;
alter table public.solicitacoes_equipe_evento add column if not exists logo_url text;

drop policy if exists solicitacoes_logo_publica on public.solicitacoes_equipe_evento;
create policy solicitacoes_logo_publica on public.solicitacoes_equipe_evento
for select to anon, authenticated
using (status = 'aprovada');
grant select (id, evento_id, equipe_id, academia, logo_url, status) on public.solicitacoes_equipe_evento to anon, authenticated;

