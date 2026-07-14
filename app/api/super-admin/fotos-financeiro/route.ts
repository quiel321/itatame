import "server-only";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Pedido = {
  id: string;
  evento_id: string | null;
  fotografo_id: string | null;
  organizador_user_id: string | null;
  status: string;
  total_centavos: number | null;
  comissao_itatame_centavos: number | null;
  comissao_organizador_centavos: number | null;
  comissao_organizador_percentual: number | null;
  repasse_organizador_status: string | null;
  pago_em: string | null;
  created_at: string;
  foto_pedido_itens?: Array<{ id: string }> | null;
};

type Galeria = {
  id: string;
  nome: string;
  status: string | null;
  organizador_user_id: string | null;
  created_by: string | null;
  data_evento: string | null;
};

type Organizador = { id: string; nome: string | null; slug: string | null };
type Fotografo = { id: string; nome: string | null; email: string | null };

function bearerToken(request: Request) {
  const header = request.headers.get("authorization") || "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7) : null;
}

async function carregarEmPaginas<T>(
  carregar: (inicio: number, fim: number) => Promise<{ data: T[] | null; error: { message: string } | null }>,
) {
  const pagina = 500;
  const todos: T[] = [];
  for (let inicio = 0; ; inicio += pagina) {
    const { data, error } = await carregar(inicio, inicio + pagina - 1);
    if (error) throw new Error(error.message);
    const lote = data || [];
    todos.push(...lote);
    if (lote.length < pagina) break;
  }
  return todos;
}

function resumoVazio() {
  return {
    faturamentoCentavos: 0,
    comissaoItatameCentavos: 0,
    royaltyGeradoCentavos: 0,
    royaltyEmAbertoCentavos: 0,
    royaltyAguardandoCentavos: 0,
    royaltyDisponivelCentavos: 0,
    royaltyPagoCentavos: 0,
    fotografoAntesTarifaCentavos: 0,
    pedidosPagos: 0,
    fotosVendidas: 0,
  };
}

function adicionarPedido(resumo: ReturnType<typeof resumoVazio>, pedido: Pedido) {
  const total = Number(pedido.total_centavos || 0);
  const itatame = Number(pedido.comissao_itatame_centavos || 0);
  const royalty = Number(pedido.comissao_organizador_centavos || 0);
  const statusRepasse = pedido.repasse_organizador_status || (royalty > 0 ? "pendente" : "nao_aplicavel");

  resumo.faturamentoCentavos += total;
  resumo.comissaoItatameCentavos += itatame;
  resumo.fotografoAntesTarifaCentavos += Math.max(0, total - itatame - royalty);
  resumo.pedidosPagos += 1;
  resumo.fotosVendidas += pedido.foto_pedido_itens?.length || 0;

  if (royalty <= 0 || statusRepasse === "estornado") return;
  resumo.royaltyGeradoCentavos += royalty;
  if (["pendente", "aguardando_liberacao", "disponivel"].includes(statusRepasse)) {
    resumo.royaltyEmAbertoCentavos += royalty;
  }
  if (["pendente", "aguardando_liberacao"].includes(statusRepasse)) resumo.royaltyAguardandoCentavos += royalty;
  if (statusRepasse === "disponivel") resumo.royaltyDisponivelCentavos += royalty;
  if (statusRepasse === "pago") resumo.royaltyPagoCentavos += royalty;
}

async function validarSuperAdmin(supabase: SupabaseClient, token: string) {
  const { data: auth, error: authError } = await supabase.auth.getUser(token);
  if (authError || !auth.user) return { status: 401 as const, error: "Sessão inválida." };
  const { data: perfil, error } = await supabase
    .from("atletas")
    .select("role")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (error || perfil?.role !== "super-admin") return { status: 403 as const, error: "Acesso exclusivo do Super Admin." };
  return { status: 200 as const, userId: auth.user.id };
}

export async function GET(request: Request) {
  try {
    const token = bearerToken(request);
    if (!token) return NextResponse.json({ error: "Login necessário." }, { status: 401 });
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Consulta administrativa não configurada no servidor." }, { status: 500 });
    }

    const supabase = createSupabaseServerClient();
    const acesso = await validarSuperAdmin(supabase, token);
    if (acesso.status !== 200) return NextResponse.json({ error: acesso.error }, { status: acesso.status });

    const [pedidos, galerias, organizadores, fotografos] = await Promise.all([
      carregarEmPaginas<Pedido>(async (inicio, fim) => {
        const resultado = await supabase
          .from("foto_pedidos")
          .select("id, evento_id, fotografo_id, organizador_user_id, status, total_centavos, comissao_itatame_centavos, comissao_organizador_centavos, comissao_organizador_percentual, repasse_organizador_status, pago_em, created_at, foto_pedido_itens(id)")
          .order("created_at", { ascending: false })
          .range(inicio, fim);
        return { data: resultado.data as Pedido[] | null, error: resultado.error };
      }),
      carregarEmPaginas<Galeria>(async (inicio, fim) => {
        const resultado = await supabase
          .from("foto_eventos")
          .select("id, nome, status, organizador_user_id, created_by, data_evento")
          .order("created_at", { ascending: false })
          .range(inicio, fim);
        return { data: resultado.data as Galeria[] | null, error: resultado.error };
      }),
      carregarEmPaginas<Organizador>(async (inicio, fim) => {
        const resultado = await supabase
          .from("foto_organizadores")
          .select("id, nome, slug")
          .order("created_at", { ascending: false })
          .range(inicio, fim);
        return { data: resultado.data as Organizador[] | null, error: resultado.error };
      }),
      carregarEmPaginas<Fotografo>(async (inicio, fim) => {
        const resultado = await supabase
          .from("fotografos")
          .select("id, nome, email")
          .order("created_at", { ascending: false })
          .range(inicio, fim);
        return { data: resultado.data as Fotografo[] | null, error: resultado.error };
      }),
    ]);

    const organizadorPorId = new Map(organizadores.map((item) => [item.id, item]));
    const fotografoPorId = new Map(fotografos.map((item) => [item.id, item]));
    const galeriaPorId = new Map(galerias.map((item) => [item.id, item]));
    const pedidosPagos = pedidos.filter((pedido) => pedido.status === "pago");
    const geral = resumoVazio();

    const porGaleria = new Map<string, ReturnType<typeof resumoVazio> & {
      id: string;
      nome: string;
      status: string | null;
      organizadorId: string | null;
      organizadorNome: string;
      dataEvento: string | null;
    }>();
    for (const galeria of galerias) {
      const organizador = galeria.organizador_user_id ? organizadorPorId.get(galeria.organizador_user_id) : null;
      porGaleria.set(galeria.id, {
        ...resumoVazio(),
        id: galeria.id,
        nome: galeria.nome,
        status: galeria.status,
        organizadorId: galeria.organizador_user_id,
        organizadorNome: organizador?.nome || (galeria.organizador_user_id ? "Organizador sem perfil público" : "Galeria freelancer"),
        dataEvento: galeria.data_evento,
      });
    }

    const porOrganizador = new Map<string, ReturnType<typeof resumoVazio> & {
      id: string;
      nome: string;
      slug: string | null;
      galerias: number;
    }>();
    for (const organizador of organizadores) {
      porOrganizador.set(organizador.id, { ...resumoVazio(), id: organizador.id, nome: organizador.nome || "Organizador", slug: organizador.slug, galerias: 0 });
    }
    for (const galeria of galerias) {
      if (!galeria.organizador_user_id) continue;
      const existente = porOrganizador.get(galeria.organizador_user_id) || {
        ...resumoVazio(), id: galeria.organizador_user_id, nome: "Organizador sem perfil público", slug: null, galerias: 0,
      };
      existente.galerias += 1;
      porOrganizador.set(galeria.organizador_user_id, existente);
    }

    for (const pedido of pedidosPagos) {
      adicionarPedido(geral, pedido);
      if (pedido.evento_id) {
        const galeriaBase = galeriaPorId.get(pedido.evento_id);
        const existente = porGaleria.get(pedido.evento_id) || {
          ...resumoVazio(),
          id: pedido.evento_id,
          nome: galeriaBase?.nome || "Galeria não localizada",
          status: galeriaBase?.status || null,
          organizadorId: pedido.organizador_user_id,
          organizadorNome: pedido.organizador_user_id ? (organizadorPorId.get(pedido.organizador_user_id)?.nome || "Organizador sem perfil público") : "Galeria freelancer",
          dataEvento: galeriaBase?.data_evento || null,
        };
        adicionarPedido(existente, pedido);
        porGaleria.set(pedido.evento_id, existente);
      }
      if (pedido.organizador_user_id) {
        const organizador = organizadorPorId.get(pedido.organizador_user_id);
        const existente = porOrganizador.get(pedido.organizador_user_id) || {
          ...resumoVazio(), id: pedido.organizador_user_id, nome: organizador?.nome || "Organizador sem perfil público", slug: organizador?.slug || null, galerias: 0,
        };
        adicionarPedido(existente, pedido);
        porOrganizador.set(pedido.organizador_user_id, existente);
      }
    }

    const statusPedidos = pedidos.reduce<Record<string, number>>((acc, pedido) => {
      acc[pedido.status] = (acc[pedido.status] || 0) + 1;
      return acc;
    }, {});

    const recentes = pedidosPagos.slice(0, 20).map((pedido) => ({
      id: pedido.id,
      data: pedido.pago_em || pedido.created_at,
      galeria: pedido.evento_id ? (galeriaPorId.get(pedido.evento_id)?.nome || "Galeria não localizada") : "Sem galeria",
      fotografo: pedido.fotografo_id ? (fotografoPorId.get(pedido.fotografo_id)?.nome || "Fotógrafo") : "Fotógrafo não localizado",
      organizador: pedido.organizador_user_id ? (organizadorPorId.get(pedido.organizador_user_id)?.nome || "Organizador sem perfil público") : "Freelancer",
      totalCentavos: Number(pedido.total_centavos || 0),
      comissaoItatameCentavos: Number(pedido.comissao_itatame_centavos || 0),
      royaltyCentavos: Number(pedido.comissao_organizador_centavos || 0),
      royaltyPercentual: Number(pedido.comissao_organizador_percentual || 0),
      repasseStatus: pedido.repasse_organizador_status || "nao_aplicavel",
      fotos: pedido.foto_pedido_itens?.length || 0,
    }));

    return NextResponse.json({
      atualizadoEm: new Date().toISOString(),
      geral: {
        ...geral,
        ticketMedioCentavos: geral.pedidosPagos ? Math.round(geral.faturamentoCentavos / geral.pedidosPagos) : 0,
        galerias: galerias.length,
        organizadores: organizadores.length,
        fotografos: fotografos.length,
        pedidosPorStatus: statusPedidos,
      },
      organizadores: [...porOrganizador.values()].sort((a, b) => b.royaltyEmAbertoCentavos - a.royaltyEmAbertoCentavos || b.faturamentoCentavos - a.faturamentoCentavos),
      galerias: [...porGaleria.values()].sort((a, b) => b.faturamentoCentavos - a.faturamentoCentavos),
      pedidosRecentes: recentes,
    }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Não foi possível montar o financeiro do Itatame Fotos.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
