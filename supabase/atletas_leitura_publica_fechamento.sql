-- Parte 2. Executar somente depois que o código que lê atletas_publico estiver em produção.
-- Fecha o buraco: hoje três policies de SELECT com qual=true deixam CPF, telefone e e-mail
-- legíveis por qualquer um com a anon key.
begin;
drop policy if exists "Leitura Publica" on public.atletas;
drop policy if exists "Leitura de Atletas" on public.atletas;
drop policy if exists "Visualização pública de atletas" on public.atletas;
commit;

-- Reversão de emergência:
-- create policy "Leitura Publica" on public.atletas for select using (true);
