-- Instala somente a função. Não ajusta nenhum contador existente.
begin;
create or replace function public.ajustar_medalha_staff(p_atleta bigint,p_coluna text,p_incremento integer)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare ev uuid;
begin
 if auth.uid() is null then raise exception 'Sessão ausente.'; end if;
 if p_coluna is null or p_coluna not in ('ouro','prata','bronze','vitorias_wo')
 or p_incremento is null or p_incremento not in (-1,1) then raise exception 'Ajuste inválido.'; end if;
 select s.evento_id into ev from public.staff_sessoes s
 join public.staff_eventos st on st.id=s.staff_evento_id and st.evento_id=s.evento_id
 where s.auth_user_id=auth.uid() and s.expira_em>now() and st.funcao='mesario' limit 1;
 if ev is null or not exists(select 1 from public.inscricoes i where i.evento_id=ev
 and i.atleta_id=p_atleta and i.pagamento_ok=true and i.estorno_status is distinct from 'estornado')
 then raise exception 'Mesário ou atleta fora do evento autorizado.'; end if;
 update public.atletas set
 ouro=case when p_coluna='ouro' then greatest(0,coalesce(ouro,0)+p_incremento) else ouro end,
 prata=case when p_coluna='prata' then greatest(0,coalesce(prata,0)+p_incremento) else prata end,
 bronze=case when p_coluna='bronze' then greatest(0,coalesce(bronze,0)+p_incremento) else bronze end,
 vitorias_wo=case when p_coluna='vitorias_wo' then greatest(0,coalesce(vitorias_wo,0)+p_incremento) else vitorias_wo end
 where id=p_atleta;
 if not found then raise exception 'Atleta não encontrado.'; end if;
end $$;
revoke all on function public.ajustar_medalha_staff(bigint,text,integer) from public,anon;
grant execute on function public.ajustar_medalha_staff(bigint,text,integer) to authenticated;
notify pgrst,'reload schema';
commit;

