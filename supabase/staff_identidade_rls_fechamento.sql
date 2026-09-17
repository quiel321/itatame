-- Executar somente depois que supabase/staff_identidade_rls.sql estiver aplicado, o posto novo estiver
-- em produção e o check-in e o placar tiverem sido testados com um PIN real.
-- Fecha o buraco: hoje "Update Autenticado" deixa qualquer usuário logado alterar a linha de qualquer atleta.
begin;
drop policy if exists "Update Autenticado" on public.atletas;
commit;

-- Reversão de emergência, se algum posto parar de gravar durante um campeonato:
-- create policy "Update Autenticado" on public.atletas for update using (auth.role() = 'authenticated');
