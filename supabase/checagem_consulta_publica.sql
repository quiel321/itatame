-- Checagem pública precisa ler categorias e equipes oficiais do evento.
drop policy if exists categorias_consulta on public.categorias_evento;
create policy categorias_consulta on public.categorias_evento for select to anon, authenticated using (true);
drop policy if exists equipes_consulta on public.equipes_evento;
create policy equipes_consulta on public.equipes_evento for select to anon, authenticated using (true);
grant select on public.categorias_evento, public.equipes_evento to anon, authenticated;
