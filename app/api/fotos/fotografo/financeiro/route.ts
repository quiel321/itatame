import "server-only";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Pedido = {
  id: string;
  evento_id: string | null;
  status: string;
  total_centavos: number | null;
  comissao_itatame_centavos: number | null;
  comissao_organizador_centavos: number | null;
  provedor_payment_id: string | null;
  pago_em: string | null;
  created_at: string;
  foto_eventos?: { id: string; nome: string } | Array<{ id: string; nome: string }> | null;
  foto_pedido_itens?: Array<{ id: string }> | null;
};

type DetalhePagamento = {
  liquidoCentavos: number;
  taxaMercadoPagoCentavos: number;
  metodo: string;
  status: string;
  expiraEm: number;
};

const globalFinanceiro = globalThis as typeof globalThis & {
  __fotoFinanceiroPagamentoCache?: Map<string, DetalhePagamento>;
};
const pagamentoCache = globalFinanceiro.__fotoFinanceiroPagamentoCache || new Map<string, DetalhePagamento>();
globalFinanceiro.__fotoFinanceiroPagamentoCache = pagamentoCache;

function bearerToken(request: Request) {
  const header = request.headers.get("authorization") || "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7) : null;
}

function primeiraRelacao<T>(valor: T | T[] | null | undefined) {
  return Array.isArray(valor) ? valor[0] : valor;
}

function paraCentavos(valor: unknown) {
  return Math.round(Number(valor || 0) * 100);
}

function nomeMetodo(payment: Record<string, unknown>) {
  const id = String(payment.payment_method_id || "").toLowerCase();
  const tipo = String(payment.payment_type_id || "").toLowerCase();
  if (id === "pix") return "Pix";
  if (tipo === "credit_card") return "Cartão de crédito";
  if (tipo === "debit_card") return "Cartão de débito";
  if (["ticket", "atm"].includes(tipo)) return "Boleto";
  if (tipo === "bank_transfer") return "Pix / transferência";
  return id || tipo || "Mercado Pago";
}

async function consultarPagamento(pedido: Pedido, accessToken: string) {
  const paymentId = String(pedido.provedor_payment_id || "");
  if (!paymentId) throw new Error("Pagamento sem identificador no provedor.");
  const chaveCache = paymentId;
  const emCache = pagamentoCache.get(chaveCache);
  if (emCache && emCache.expiraEm > Date.now()) return emCache;

  const response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const payment = await response.json();
  if (!response.ok) throw new Error(payment?.message || "Pagamento indisponível no Mercado Pago.");

  const brutoCentavos = paraCentavos(payment.transaction_amount);
  if (payment.external_reference !== `foto_pedido:${pedido.id}` || brutoCentavos !== Number(pedido.total_centavos || 0)) {
    throw new Error("Pagamento divergente do pedido.");
  }

  const taxas = Array.isArray(payment.fee_details) ? payment.fee_details : [];
  const taxaInformadaCentavos = taxas
    .filter((taxa: { type?: string }) => taxa?.type === "mercadopago_fee")
    .reduce((total: number, taxa: { amount?: number }) => total + paraCentavos(taxa?.amount), 0);
  const liquidoCentavos = paraCentavos(payment.transaction_details?.net_received_amount);
  const marketplaceCentavos = Number(pedido.comissao_itatame_centavos || 0)
    + Number(pedido.comissao_organizador_centavos || 0);
  const taxaCalculadaCentavos = Math.max(0, brutoCentavos - marketplaceCentavos - liquidoCentavos);

  const detalhe: DetalhePagamento = {
    liquidoCentavos,
    taxaMercadoPagoCentavos: taxaInformadaCentavos || taxaCalculadaCentavos,
    metodo: nomeMetodo(payment),
    status: String(payment.status || ""),
    expiraEm: Date.now() + 10 * 60 * 1000,
  };
  pagamentoCache.set(chaveCache, detalhe);
  return detalhe;
}

async function carregarPedidos(fotografoId: string) {
  const supabase = createSupabaseServerClient();
  const todos: Pedido[] = [];
  const tamanhoPagina = 250;
  for (let inicio = 0; ; inicio += tamanhoPagina) {
    const { data, error } = await supabase
      .from("foto_pedidos")
      .select("id, evento_id, status, total_centavos, comissao_itatame_centavos, comissao_organizador_centavos, provedor_payment_id, pago_em, created_at, foto_eventos(id, nome), foto_pedido_itens(id)")
      .eq("fotografo_id", fotografoId)
      .in("status", ["pago", "reembolsado"])
      .order("created_at", { ascending: false })
      .range(inicio, inicio + tamanhoPagina - 1);
    if (error) throw new Error(error.message);
    const lote = (data || []) as Pedido[];
    todos.push(...lote);
    if (lote.length < tamanhoPagina) break;
  }
  return todos;
}

export async function GET(request: Request) {
  try {
    const token = bearerToken(request);
    if (!token) return NextResponse.json({ error: "Login necessário." }, { status: 401 });

    const supabase = createSupabaseServerClient();
    const { data: auth, error: authError } = await supabase.auth.getUser(token);
    if (authError || !auth.user) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });

    const { data: fotografo, error: fotografoError } = await supabase
      .from("fotografos")
      .select("id, mp_access_token")
      .eq("user_id", auth.user.id)
      .eq("status", "ativo")
      .maybeSingle();
    if (fotografoError) throw new Error(fotografoError.message);
    if (!fotografo) return NextResponse.json({ error: "Perfil de fotógrafo não encontrado." }, { status: 403 });

    const pedidos = await carregarPedidos(fotografo.id);
    const pagos = pedidos.filter((pedido) => pedido.status === "pago");
    const reembolsados = pedidos.filter((pedido) => pedido.status === "reembolsado");
    const detalhes = new Map<string, DetalhePagamento>();
    const falhas = new Set<string>();

    if (fotografo.mp_access_token) {
      for (let inicio = 0; inicio < pagos.length; inicio += 5) {
        const lote = pagos.slice(inicio, inicio + 5);
        const resultados = await Promise.allSettled(
          lote.map((pedido) => consultarPagamento(pedido, fotografo.mp_access_token)),
        );
        resultados.forEach((resultado, indice) => {
          const pedido = lote[indice];
          if (resultado.status === "fulfilled") detalhes.set(pedido.id, resultado.value);
          else falhas.add(pedido.id);
        });
      }
    } else {
      pagos.forEach((pedido) => falhas.add(pedido.id));
    }

    const vendas = pagos.map((pedido) => {
      const evento = primeiraRelacao(pedido.foto_eventos);
      const detalhe = detalhes.get(pedido.id);
      const itatame = Number(pedido.comissao_itatame_centavos || 0);
      const royalty = Number(pedido.comissao_organizador_centavos || 0);
      return {
        id: pedido.id,
        eventoId: pedido.evento_id,
        galeria: evento?.nome || "Galeria removida",
        data: pedido.pago_em || pedido.created_at,
        fotos: pedido.foto_pedido_itens?.length || 0,
        brutoCentavos: Number(pedido.total_centavos || 0),
        itatameCentavos: itatame,
        royaltyCentavos: royalty,
        taxaMercadoPagoCentavos: detalhe?.taxaMercadoPagoCentavos ?? null,
        liquidoCentavos: detalhe?.liquidoCentavos ?? null,
        liquidoAntesTarifaCentavos: Math.max(0, Number(pedido.total_centavos || 0) - itatame - royalty),
        metodo: detalhe?.metodo || null,
        confirmadoPeloMercadoPago: Boolean(detalhe),
      };
    });

    const resumo = vendas.reduce((total, venda) => ({
      vendas: total.vendas + 1,
      fotos: total.fotos + venda.fotos,
      brutoCentavos: total.brutoCentavos + venda.brutoCentavos,
      itatameCentavos: total.itatameCentavos + venda.itatameCentavos,
      royaltyCentavos: total.royaltyCentavos + venda.royaltyCentavos,
      taxaMercadoPagoCentavos: total.taxaMercadoPagoCentavos + (venda.taxaMercadoPagoCentavos || 0),
      liquidoCentavos: total.liquidoCentavos + (venda.liquidoCentavos || 0),
    }), { vendas: 0, fotos: 0, brutoCentavos: 0, itatameCentavos: 0, royaltyCentavos: 0, taxaMercadoPagoCentavos: 0, liquidoCentavos: 0 });

    const galerias = new Map<string, {
      id: string;
      nome: string;
      vendas: number;
      fotos: number;
      brutoCentavos: number;
      liquidoCentavos: number;
      pendentesDeConfirmacao: number;
    }>();
    for (const venda of vendas) {
      const chave = venda.eventoId || "removida";
      const atual = galerias.get(chave) || { id: chave, nome: venda.galeria, vendas: 0, fotos: 0, brutoCentavos: 0, liquidoCentavos: 0, pendentesDeConfirmacao: 0 };
      atual.vendas += 1;
      atual.fotos += venda.fotos;
      atual.brutoCentavos += venda.brutoCentavos;
      atual.liquidoCentavos += venda.liquidoCentavos || 0;
      if (!venda.confirmadoPeloMercadoPago) atual.pendentesDeConfirmacao += 1;
      galerias.set(chave, atual);
    }

    return NextResponse.json({
      resumo,
      galerias: Array.from(galerias.values()).sort((a, b) => b.liquidoCentavos - a.liquidoCentavos),
      vendas,
      reembolsos: {
        quantidade: reembolsados.length,
        valorCentavos: reembolsados.reduce((total, pedido) => total + Number(pedido.total_centavos || 0), 0),
      },
      vendasSemConfirmacao: falhas.size,
      atualizadoEm: new Date().toISOString(),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error: unknown) {
    console.error("Financeiro do fotógrafo:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível carregar o financeiro." },
      { status: 500, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
