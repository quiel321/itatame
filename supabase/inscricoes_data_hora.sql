-- Preserva datas históricas conhecidas. Registros antigos sem data continuam nulos.
-- Executar no SQL Editor do Supabase. Novas inscrições usam o relógio do banco.
begin;
alter table public.inscricoes add column if not exists created_at timestamptz;
alter table public.inscricoes alter column created_at set default now();

create or replace function public.preservar_data_inscricao()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := statement_timestamp();
  else
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

drop trigger if exists inscricoes_preservar_data on public.inscricoes;
create trigger inscricoes_preservar_data
before insert or update on public.inscricoes
for each row execute function public.preservar_data_inscricao();
notify pgrst, 'reload schema';
commit;
