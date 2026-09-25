import { loadEnvConfig } from "@next/env";
import { createSupabaseServerClient } from "../app/lib/supabase-server";

loadEnvConfig(process.cwd());

type PedidoPago = {
  id: string;
  total_centavos: number | null;
  provedor_payment_id: string | null;
  pago_em: string | null;
  fotografos?: { mp_access_token: string | null } | Array<{ mp_access_token: string | null }> | null;
};

type Acumulado = { pedidos: number; brutoCentavos: number; taxaCentavos: number };

function argumentoNumero(nome: string, padrao: number) {
  const valor = process.argv.find((arg) => arg.startsWith(`--${nome}=`))?.split("=")[1];
  const numero = Number(valor || padrao);
  return Number.isFinite(numero) && numero > 0 ? Math.floor(numero) : padrao;
}

function primeiraRelacao<T>(valor: T | T[] | null | undefined) {
  return Array.isArray(valor) ? valor[0] : valor;
}

function paraCentavos(valor: unknown) {
  return Math.round(Number(valor || 0) * 100);
}

function formatarReais(centavos: number) {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function nomeMetodo(payment: Record<string, unknown>) {
  const id = String(payment.payment_method_id || "").toLowerCase();
  const tipo = String(payment.payment_type_id || "").toLowerCase();
  if (id === "pix") return "Pix";
  if (tipo === "credit_card") return "Cartão de crédito";
  if (tipo === "debit_card") return "Cartão de débito";
  if (["ticket", "atm"].includes(tipo)) return "Boleto";
  if (tipo === "account_money") return "Saldo Mercado Pago";
  if (tipo === "bank_transfer") return "Pix / transferência";
  return id || tipo || "Outro";
}

async function carregarPedidos(desde: string) {
  const supabase = createSupabaseServerClient();
  const pedidos: PedidoPago[] = [];
  const pagina = 500;
  for (let inicio = 0; ; inicio += pagina) {
    const { data, error } = await supabase
      .from("foto_pedidos")
      .select("id, total_centavos, provedor_payment_id, pago_em, fotografos(mp_access_token)")
      .eq("status", "pago")
      .not("provedor_payment_id", "is", null)
      .gte("pago_em", desde)
      .order("pago_em", { ascending: true })
      .range(inicio, inicio + pagina - 1);
    if (error) throw new Error(error.message);
    pedidos.push(...((data || []) as PedidoPago[]));
    if (!data || data.length < pagina) break;
  }
  return pedidos;
}

async function main() {
  const dias = argumentoNumero("dias", 90);
  const concorrencia = Math.min(6, argumentoNumero("concurrency", 4));
  const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();
  const pedidos = await carregarPedidos(desde);
  console.log(`[meios-pagamento] ${pedidos.length} pedido(s) pago(s) nos últimos ${dias} dia(s).`);

  const porMetodo = new Map<string, Acumulado>();
  const falhas: Array<{ id: string; erro: string }> = [];
  let proxima = 0;

  async function worker() {
    while (true) {
      const indice = proxima++;
      if (indice >= pedidos.length) return;
      const pedido = pedidos[indice];
      try {
        const token = primeiraRelacao(pedido.fotografos)?.mp_access_token;
        if (!token) throw new Error("Fotógrafo sem token do Mercado Pago.");
        const response = await fetch(
          `https://api.mercadopago.com/v1/payments/${encodeURIComponent(String(pedido.provedor_payment_id))}`,
          { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
        );
        const payment = await response.json();
        if (!response.ok) throw new Error(payment?.message || `HTTP ${response.status}`);

        const taxas = Array.isArray(payment.fee_details) ? payment.fee_details : [];
        const taxaCentavos = taxas
          .filter((taxa: { type?: string }) => taxa?.type === "mercadopago_fee")
          .reduce((total: number, taxa: { amount?: number }) => total + paraCentavos(taxa?.amount), 0);

        const metodo = nomeMetodo(payment);
        const atual = porMetodo.get(metodo) || { pedidos: 0, brutoCentavos: 0, taxaCentavos: 0 };
        atual.pedidos += 1;
        atual.brutoCentavos += paraCentavos(payment.transaction_amount);
        atual.taxaCentavos += taxaCentavos;
        porMetodo.set(metodo, atual);
      } catch (error: unknown) {
        falhas.push({ id: pedido.id, erro: error instanceof Error ? error.message : String(error) });
      }
    }
  }

  await Promise.all(Array.from({ length: concorrencia }, () => worker()));

  const totalPedidos = [...porMetodo.values()].reduce((total, item) => total + item.pedidos, 0);
  const totalBruto = [...porMetodo.values()].reduce((total, item) => total + item.brutoCentavos, 0);
  const totalTaxa = [...porMetodo.values()].reduce((total, item) => total + item.taxaCentavos, 0);

  console.table(
    [...porMetodo.entries()]
      .sort((a, b) => b[1].pedidos - a[1].pedidos)
      .map(([metodo, item]) => ({
        Meio: metodo,
        Pedidos: item.pedidos,
        "% pedidos": totalPedidos ? `${((item.pedidos / totalPedidos) * 100).toFixed(1)}%` : "-",
        Bruto: formatarReais(item.brutoCentavos),
        "Taxa MP": formatarReais(item.taxaCentavos),
        "Taxa efetiva": item.brutoCentavos ? `${((item.taxaCentavos / item.brutoCentavos) * 100).toFixed(2)}%` : "-",
        "Ticket médio": formatarReais(item.pedidos ? Math.round(item.brutoCentavos / item.pedidos) : 0),
      })),
  );
  console.log(
    `[meios-pagamento] Total: ${totalPedidos} pedido(s), bruto ${formatarReais(totalBruto)}, taxa MP ${formatarReais(totalTaxa)}` +
    (totalBruto ? ` (${((totalTaxa / totalBruto) * 100).toFixed(2)}%).` : "."),
  );

  if (falhas.length) {
    console.error(`[meios-pagamento] ${falhas.length} pedido(s) não consultado(s):`);
    console.error(JSON.stringify(falhas, null, 2));
  }
}

main().catch((error: unknown) => {
  console.error(`[meios-pagamento] Erro fatal: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
