-- Impede novos identificadores duplicados sem alterar registros legados.
-- Perfis originados do Retratt (status ativo ou foto_organizadores) ficam fora da regra de organizadores.
begin;

create or replace function public.validar_identidade_unica_itatame()
returns trigger language plpgsql security definer set search_path = public as $$
declare valor text;
begin
  if tg_table_name = 'atletas' then
    if tg_op = 'INSERT' or new.cpf is distinct from old.cpf then
      valor := regexp_replace(coalesce(new.cpf, ''), '[^0-9]', '', 'g');
      if valor <> '' then perform pg_advisory_xact_lock(hashtextextended('atletas:cpf:' || valor, 0)); end if;
      if valor <> '' and exists (
        select 1 from public.atletas a where a.id is distinct from new.id
        and regexp_replace(coalesce(a.cpf, ''), '[^0-9]', '', 'g') = valor
      ) then raise exception 'Este CPF já pertence a outra conta.' using errcode = '23505'; end if;
    end if;
    if tg_op = 'INSERT' or new.telefone is distinct from old.telefone then
      valor := regexp_replace(coalesce(new.telefone, ''), '[^0-9]', '', 'g');
      if valor <> '' then perform pg_advisory_xact_lock(hashtextextended('atletas:telefone:' || valor, 0)); end if;
      if valor <> '' and exists (
        select 1 from public.atletas a where a.id is distinct from new.id
        and regexp_replace(coalesce(a.telefone, ''), '[^0-9]', '', 'g') = valor
      ) then raise exception 'Este telefone já pertence a outra conta.' using errcode = '23505'; end if;
    end if;
    if tg_op = 'INSERT' or new.email is distinct from old.email then
      valor := lower(trim(coalesce(new.email, '')));
      if valor <> '' then perform pg_advisory_xact_lock(hashtextextended('atletas:email:' || valor, 0)); end if;
      if valor <> '' and exists (
        select 1 from public.atletas a where a.id is distinct from new.id
        and lower(trim(coalesce(a.email, ''))) = valor
      ) then raise exception 'Este e-mail já pertence a outra conta.' using errcode = '23505'; end if;
    end if;
  elsif tg_table_name = 'organizadores' then
    if new.status = 'ativo' or exists (select 1 from public.foto_organizadores f where f.id::text = new.user_id::text) then
      return new;
    end if;
    if tg_op = 'INSERT' or new.telefone is distinct from old.telefone then
      valor := regexp_replace(coalesce(new.telefone, ''), '[^0-9]', '', 'g');
      if valor <> '' then perform pg_advisory_xact_lock(hashtextextended('organizadores:telefone:' || valor, 0)); end if;
      if valor <> '' and exists (
        select 1 from public.organizadores o where o.user_id::text <> new.user_id::text and o.status is distinct from 'ativo'
        and not exists (select 1 from public.foto_organizadores f where f.id::text = o.user_id::text)
        and regexp_replace(coalesce(o.telefone, ''), '[^0-9]', '', 'g') = valor
      ) then raise exception 'Este telefone já pertence a outro organizador.' using errcode = '23505'; end if;
    end if;
    if tg_op = 'INSERT' or new.email is distinct from old.email then
      valor := lower(trim(coalesce(new.email, '')));
      if valor <> '' then perform pg_advisory_xact_lock(hashtextextended('organizadores:email:' || valor, 0)); end if;
      if valor <> '' and exists (
        select 1 from public.organizadores o where o.user_id::text <> new.user_id::text and o.status is distinct from 'ativo'
        and not exists (select 1 from public.foto_organizadores f where f.id::text = o.user_id::text)
        and lower(trim(coalesce(o.email, ''))) = valor
      ) then raise exception 'Este e-mail já pertence a outro organizador.' using errcode = '23505'; end if;
    end if;
    if tg_op = 'INSERT' or new.documento is distinct from old.documento then
      valor := regexp_replace(coalesce(new.documento, ''), '[^0-9]', '', 'g');
      if valor <> '' then perform pg_advisory_xact_lock(hashtextextended('organizadores:documento:' || valor, 0)); end if;
      if valor <> '' and exists (
        select 1 from public.organizadores o where o.user_id::text <> new.user_id::text and o.status is distinct from 'ativo'
        and not exists (select 1 from public.foto_organizadores f where f.id::text = o.user_id::text)
        and regexp_replace(coalesce(o.documento, ''), '[^0-9]', '', 'g') = valor
      ) then raise exception 'Este CPF/CNPJ já pertence a outro organizador.' using errcode = '23505'; end if;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists validar_identidade_atletas_itatame on public.atletas;
create trigger validar_identidade_atletas_itatame before insert or update of cpf, telefone, email
on public.atletas for each row execute function public.validar_identidade_unica_itatame();

drop trigger if exists validar_identidade_organizadores_itatame on public.organizadores;
create trigger validar_identidade_organizadores_itatame before insert or update of telefone, email, documento
on public.organizadores for each row execute function public.validar_identidade_unica_itatame();

commit;
