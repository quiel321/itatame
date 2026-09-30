-- A correção de equipe deve ser feita por inscrição individual.
-- Desativa a antiga RPC de vínculo em massa sem alterar inscrições existentes.
begin;
revoke execute on function public.unificar_equipes_evento(uuid, uuid, text[]) from authenticated;
commit;
