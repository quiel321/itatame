-- Confiabilidade de e-mails, cortesias e configuração financeira do iTatame.
-- Migração aditiva: preserva eventos, inscrições, pagamentos e chaves existentes.
begin;

alter table public.inscricoes
  add column if not exists email text,
  add column if not exists cupom_id uuid references public.cupons(id),
  add column if not exists cupom_codigo text,
  add column if not exists desconto_valor numeric(10,2) not null default 0,
  add column if not exists cortesia boolean not null default false,
  add column if not exists email_ingresso_status text not null default 'pendente',
  add column if not exists email_ingresso_tentativas integer not null default 0,
  add column if not exists email_ingresso_destino text,
  add column if not exists email_ingresso_enviado_em timestamptz,
  add column if not exists email_ingresso_erro text,
  add column if not exists email_ingresso_resend_id text;

do $$ begin
  alter table public.inscricoes add constraint inscricoes_email_ingresso_status_check
    check (email_ingresso_status in ('pendente','enviando','enviado','erro'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.inscricoes add constraint inscricoes_desconto_valor_check
    check (desconto_valor >= 0);
exception when duplicate_object then null; end $$;

create index if not exists inscricoes_email_ingresso_pendentes
  on public.inscricoes (email_ingresso_status, pagamento_ok)
  where pagamento_ok = true and email_ingresso_status <> 'enviado';

alter table public.cupons
  add column if not exists finalidade text not null default 'promocional',
  add column if not exists beneficiario text,
  add column if not exists observacoes text,
  add column if not exists ativo boolean not null default true,
  add column if not exists expira_em timestamptz;

do $$ begin
  alter table public.cupons add constraint cupons_finalidade_check
    check (finalidade in ('promocional','projeto_social','cortesia'));
exception when duplicate_object then null; end $$;

alter table public.organizadores
  alter column plano_comercial set default 'essencial',
  alter column comissao_percentual set default 5;

update public.organizadores
set plano_comercial = coalesce(nullif(plano_comercial, ''), 'essencial'),
    comissao_percentual = case when coalesce(nullif(plano_comercial, ''), 'essencial') = 'completo' then 10 else 5 end
where plano_comercial is null
   or plano_comercial not in ('essencial','completo')
   or comissao_percentual is distinct from case when plano_comercial = 'completo' then 10 else 5 end;

create or replace function public.sincronizar_comissao_plano_organizador()
returns trigger language plpgsql set search_path=public as $$
begin
  new.plano_comercial := case when new.plano_comercial = 'completo' then 'completo' else 'essencial' end;
  new.comissao_percentual := case when new.plano_comercial = 'completo' then 10 else 5 end;
  return new;
end $$;

drop trigger if exists sincronizar_comissao_plano_organizador on public.organizadores;
create trigger sincronizar_comissao_plano_organizador
before insert or update of plano_comercial,comissao_percentual on public.organizadores
for each row execute function public.sincronizar_comissao_plano_organizador();

notify pgrst, 'reload schema';
commit;
