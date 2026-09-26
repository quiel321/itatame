-- Execute antes de publicar as alterações de preço do Retratt.
alter table public.foto_eventos
  add column if not exists preco_bloqueado boolean not null default false;
alter table public.foto_eventos
  add column if not exists preco_video_centavos integer not null default 2500 check (preco_video_centavos >= 0);

create or replace function public.respeitar_preco_bloqueado_fotos()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  galeria record;
begin
  select preco_bloqueado, preco_padrao_centavos, preco_video_centavos into galeria
  from public.foto_eventos where id = new.evento_id;
  if coalesce(galeria.preco_bloqueado, false) then
    if tg_op = 'INSERT' then
      new.preco_centavos := case when new.mime_type like 'video/%' then galeria.preco_video_centavos else galeria.preco_padrao_centavos end;
    elsif (new.preco_centavos is distinct from old.preco_centavos
      or new.evento_id is distinct from old.evento_id
      or new.mime_type is distinct from old.mime_type)
      and new.preco_centavos is distinct from (case when new.mime_type like 'video/%' then galeria.preco_video_centavos else galeria.preco_padrao_centavos end) then
      raise exception 'O preço desta galeria está bloqueado pelo organizador.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists respeitar_preco_bloqueado_fotos on public.foto_arquivos;
create trigger respeitar_preco_bloqueado_fotos
  before insert or update of preco_centavos, evento_id, mime_type on public.foto_arquivos
  for each row execute function public.respeitar_preco_bloqueado_fotos();

create or replace function public.aplicar_preco_bloqueado_fotos()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.preco_bloqueado and
    (new.preco_bloqueado is distinct from old.preco_bloqueado
      or new.preco_padrao_centavos is distinct from old.preco_padrao_centavos
      or new.preco_video_centavos is distinct from old.preco_video_centavos) then
    update public.foto_arquivos
    set preco_centavos = case when mime_type like 'video/%' then new.preco_video_centavos else new.preco_padrao_centavos end
    where evento_id = new.id and preco_centavos is distinct from (case when mime_type like 'video/%' then new.preco_video_centavos else new.preco_padrao_centavos end);
  end if;
  return new;
end;
$$;

drop trigger if exists aplicar_preco_bloqueado_fotos on public.foto_eventos;
create trigger aplicar_preco_bloqueado_fotos
  after update of preco_bloqueado, preco_padrao_centavos, preco_video_centavos on public.foto_eventos
  for each row execute function public.aplicar_preco_bloqueado_fotos();
