-- Álbuns do fotógrafo (foto_eventos): acesso por link e download gratuito.
-- Os valores padrão preservam todos os álbuns e pedidos existentes.
alter table public.foto_eventos
  add column if not exists acesso_por_link boolean not null default false,
  add column if not exists acesso_token uuid not null default gen_random_uuid(),
  add column if not exists permite_download_gratis boolean not null default false;

create unique index if not exists foto_eventos_acesso_token_key
  on public.foto_eventos(acesso_token);

drop policy if exists foto_eventos_publicados_select on public.foto_eventos;
create policy foto_eventos_publicados_select on public.foto_eventos
  for select using (status = 'publicado' and not acesso_por_link);

drop policy if exists foto_albuns_publicados_select on public.foto_albuns;
create policy foto_albuns_publicados_select on public.foto_albuns
  for select using (
    status = 'publicado' and exists (
      select 1 from public.foto_eventos evento
      where evento.id = foto_albuns.evento_id
        and evento.status = 'publicado' and not evento.acesso_por_link
    )
  );

drop policy if exists foto_arquivos_publicados_select on public.foto_arquivos;
create policy foto_arquivos_publicados_select on public.foto_arquivos
  for select using (
    status = 'publicada' and exists (
      select 1 from public.foto_eventos evento
      where evento.id = foto_arquivos.evento_id
        and evento.status = 'publicado' and not evento.acesso_por_link
    )
  );

-- Compras antigas continuam visíveis ao próprio comprador, mesmo após ocultar o álbum.
drop policy if exists foto_arquivos_comprados_select on public.foto_arquivos;
create policy foto_arquivos_comprados_select on public.foto_arquivos
  for select using (exists (
    select 1 from public.foto_pedido_itens item
    join public.foto_pedidos pedido on pedido.id = item.pedido_id
    where item.foto_id = foto_arquivos.id
      and pedido.comprador_user_id = auth.uid()
      and pedido.status = 'pago'
  ));
