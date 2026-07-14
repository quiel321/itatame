-- iTatame Fotos - royalties de organizadores no Split 1:1
-- Execute depois de fotos_checkout.sql e fotos_seguranca_e_perfis.sql.
-- O Mercado Pago continua recebendo o token OAuth do fotografo. A parcela do
-- organizador e retida junto da comissao do marketplace e registrada para repasse.

alter table public.foto_pedidos
  add column if not exists organizador_user_id uuid references auth.users(id) on delete set null,
  add column if not exists comissao_organizador_percentual numeric(5,2) not null default 0
    check (comissao_organizador_percentual between 0 and 15),
  add column if not exists comissao_organizador_centavos integer not null default 0
    check (comissao_organizador_centavos >= 0),
  add column if not exists repasse_organizador_status text not null default 'nao_aplicavel'
    check (repasse_organizador_status in ('nao_aplicavel', 'pendente', 'aguardando_liberacao', 'disponivel', 'pago', 'estornado'));

create index if not exists idx_foto_pedidos_organizador
  on public.foto_pedidos(organizador_user_id, created_at desc);
create index if not exists idx_foto_pedidos_repasse_organizador
  on public.foto_pedidos(repasse_organizador_status, created_at desc)
  where comissao_organizador_centavos > 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'foto_evento_fotografos_royalty_lte_15'
      and conrelid = 'public.foto_evento_fotografos'::regclass
  ) then
    alter table public.foto_evento_fotografos
      add constraint foto_evento_fotografos_royalty_lte_15
      check (comissao_organizador_percentual between 0 and 15);
  end if;
end
$$;

create table if not exists public.foto_royalties_organizador (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null unique references public.foto_pedidos(id) on delete cascade,
  evento_id uuid references public.foto_eventos(id) on delete set null,
  fotografo_id uuid references public.fotografos(id) on delete set null,
  organizador_user_id uuid not null references auth.users(id) on delete restrict,
  percentual numeric(5,2) not null check (percentual > 0 and percentual <= 15),
  valor_centavos integer not null check (valor_centavos > 0),
  status text not null default 'pendente'
    check (status in ('pendente', 'aguardando_liberacao', 'disponivel', 'pago', 'estornado')),
  provedor_payment_id text,
  liberado_em timestamptz,
  pago_em timestamptz,
  estornado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_foto_royalties_organizador_usuario
  on public.foto_royalties_organizador(organizador_user_id, status, created_at desc);

drop trigger if exists set_foto_royalties_organizador_updated_at on public.foto_royalties_organizador;
create trigger set_foto_royalties_organizador_updated_at
  before update on public.foto_royalties_organizador
  for each row execute function public.set_updated_at();

alter table public.foto_royalties_organizador enable row level security;

drop policy if exists foto_royalties_organizador_own_select on public.foto_royalties_organizador;
create policy foto_royalties_organizador_own_select
  on public.foto_royalties_organizador for select
  using (organizador_user_id = auth.uid());

comment on column public.foto_pedidos.comissao_organizador_centavos is
  'Snapshot do royalty do organizador no momento da compra. Nao altera o recebedor OAuth do fotografo.';
