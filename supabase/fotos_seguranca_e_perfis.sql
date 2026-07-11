-- iTatame Fotos - perfis, credenciamento e autorizacao
-- Execute esta migracao depois de fotos_schema.sql.

create extension if not exists pgcrypto;
create extension if not exists unaccent;

create table if not exists public.foto_organizadores (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  slug text not null unique,
  localizacao text,
  avatar_url text,
  capa_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.foto_evento_fotografos (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.foto_eventos(id) on delete cascade,
  fotografo_id uuid not null references public.fotografos(id) on delete cascade,
  status text not null default 'ativo'
    check (status in ('convidado', 'ativo', 'suspenso')),
  comissao_organizador_percentual numeric(5,2) not null default 0
    check (comissao_organizador_percentual between 0 and 90),
  convidado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (evento_id, fotografo_id)
);

create index if not exists idx_foto_evento_fotografos_evento
  on public.foto_evento_fotografos(evento_id, status);
create index if not exists idx_foto_evento_fotografos_fotografo
  on public.foto_evento_fotografos(fotografo_id, status);

-- Preserva o acesso de quem ja publicou albuns ou fotos antes desta migracao.
insert into public.foto_evento_fotografos (evento_id, fotografo_id, status)
select distinct evento_id, fotografo_id, 'ativo'
from public.foto_albuns
where fotografo_id is not null
on conflict (evento_id, fotografo_id) do nothing;

insert into public.foto_evento_fotografos (evento_id, fotografo_id, status)
select distinct evento_id, fotografo_id, 'ativo'
from public.foto_arquivos
where fotografo_id is not null
on conflict (evento_id, fotografo_id) do nothing;

drop trigger if exists set_foto_organizadores_updated_at on public.foto_organizadores;
create trigger set_foto_organizadores_updated_at
  before update on public.foto_organizadores
  for each row execute function public.set_updated_at();

drop trigger if exists set_foto_evento_fotografos_updated_at on public.foto_evento_fotografos;
create trigger set_foto_evento_fotografos_updated_at
  before update on public.foto_evento_fotografos
  for each row execute function public.set_updated_at();

alter table public.foto_organizadores enable row level security;
alter table public.foto_evento_fotografos enable row level security;

drop policy if exists foto_organizadores_public_select on public.foto_organizadores;
create policy foto_organizadores_public_select
  on public.foto_organizadores for select using (true);

drop policy if exists foto_organizadores_own_insert on public.foto_organizadores;
create policy foto_organizadores_own_insert
  on public.foto_organizadores for insert with check (id = auth.uid());

drop policy if exists foto_organizadores_own_update on public.foto_organizadores;
create policy foto_organizadores_own_update
  on public.foto_organizadores for update
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists foto_evento_fotografos_visible on public.foto_evento_fotografos;
create policy foto_evento_fotografos_visible
  on public.foto_evento_fotografos for select using (
    exists (
      select 1 from public.fotografos f
      where f.id = fotografo_id and f.user_id = auth.uid()
    )
    or exists (
      select 1 from public.foto_eventos e
      where e.id = evento_id and e.organizador_user_id = auth.uid()
    )
  );

drop policy if exists foto_evento_fotografos_owner_insert on public.foto_evento_fotografos;
create policy foto_evento_fotografos_owner_insert
  on public.foto_evento_fotografos for insert with check (
    exists (
      select 1 from public.foto_eventos e
      where e.id = evento_id and e.organizador_user_id = auth.uid()
    )
  );

drop policy if exists foto_evento_fotografos_owner_update on public.foto_evento_fotografos;
create policy foto_evento_fotografos_owner_update
  on public.foto_evento_fotografos for update using (
    exists (
      select 1 from public.foto_eventos e
      where e.id = evento_id and e.organizador_user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.foto_eventos e
      where e.id = evento_id and e.organizador_user_id = auth.uid()
    )
  );

drop policy if exists foto_evento_fotografos_owner_delete on public.foto_evento_fotografos;
create policy foto_evento_fotografos_owner_delete
  on public.foto_evento_fotografos for delete using (
    exists (
      select 1 from public.foto_eventos e
      where e.id = evento_id and e.organizador_user_id = auth.uid()
    )
  );

-- Impede que um fotógrafo contorne as APIs e grave em outro evento usando o
-- cliente do navegador diretamente.
drop policy if exists foto_albuns_fotografo_all on public.foto_albuns;
create policy foto_albuns_fotografo_all
  on public.foto_albuns for all using (
    exists (
      select 1 from public.fotografos f
      join public.foto_evento_fotografos c on c.fotografo_id = f.id
      where f.id = foto_albuns.fotografo_id
        and f.user_id = auth.uid()
        and c.evento_id = foto_albuns.evento_id
        and c.status = 'ativo'
    )
  ) with check (
    exists (
      select 1 from public.fotografos f
      join public.foto_evento_fotografos c on c.fotografo_id = f.id
      where f.id = foto_albuns.fotografo_id
        and f.user_id = auth.uid()
        and c.evento_id = foto_albuns.evento_id
        and c.status = 'ativo'
    )
  );

drop policy if exists foto_arquivos_fotografo_all on public.foto_arquivos;
create policy foto_arquivos_fotografo_all
  on public.foto_arquivos for all using (
    exists (
      select 1 from public.fotografos f
      join public.foto_evento_fotografos c on c.fotografo_id = f.id
      where f.id = foto_arquivos.fotografo_id
        and f.user_id = auth.uid()
        and c.evento_id = foto_arquivos.evento_id
        and c.status = 'ativo'
    )
  ) with check (
    exists (
      select 1 from public.fotografos f
      join public.foto_evento_fotografos c on c.fotografo_id = f.id
      where f.id = foto_arquivos.fotografo_id
        and f.user_id = auth.uid()
        and c.evento_id = foto_arquivos.evento_id
        and c.status = 'ativo'
    )
  );

-- O perfil inicial nasce junto com o usuario, inclusive quando a confirmacao
-- de e-mail impede que o navegador tenha uma sessao logo apos o cadastro.
create or replace function public.criar_perfil_itatame_fotos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  perfil text := new.raw_user_meta_data ->> 'foto_perfil';
  nome_usuario text := coalesce(
    nullif(new.raw_user_meta_data ->> 'nome_completo', ''),
    split_part(coalesce(new.email, 'usuario'), '@', 1)
  );
  slug_usuario text;
begin
  if perfil is null or perfil not in ('comprador', 'fotografo', 'organizador') then
    return new;
  elsif perfil = 'fotografo' then
    if not exists (select 1 from public.fotografos where user_id = new.id) then
      insert into public.fotografos (user_id, nome, email, status)
      values (new.id, nome_usuario, new.email, 'ativo');
    end if;
  elsif perfil = 'organizador' then
    slug_usuario := trim(both '-' from regexp_replace(lower(unaccent(nome_usuario)), '[^a-z0-9]+', '-', 'g'));
    insert into public.foto_organizadores (id, nome, slug, localizacao)
    values (new.id, nome_usuario, slug_usuario || '-' || left(new.id::text, 8), 'Brasil')
    on conflict (id) do nothing;
  else
    insert into public.foto_compradores (user_id, nome, email)
    values (new.id, nome_usuario, new.email)
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists criar_perfil_itatame_fotos on auth.users;
create trigger criar_perfil_itatame_fotos
  after insert on auth.users
  for each row execute function public.criar_perfil_itatame_fotos();
