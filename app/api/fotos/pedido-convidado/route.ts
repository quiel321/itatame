import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";
import { acessoPedidoValido } from "@/app/lib/fotos-convidado";

export const runtime = "nodejs";

function primeiraRelacao<T>(valor: T | T[] | null | undefined) {
  return Array.isArray(valor) ? valor[0] : valor;
}

export async function GET(request: Request) {
  const parametros = new URL(request.url).searchParams;
  const pedidoId = parametros.get("pedido_id") || "";
  if (!acessoPedidoValido(pedidoId, parametros.get("acesso"))) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }

  const supabase = createSupabaseServerClient();
  const { data: pedido, error } = await supabase
    .from("foto_pedidos")
    .select("id, status, comprador_email, total_centavos, foto_pedido_itens(id, download_liberado, download_expires_at, foto_arquivos(id, titulo, mime_type))")
    .eq("id", pedidoId)
    .maybeSingle();
  if (error || !pedido) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });

  return NextResponse.json({
    id: pedido.id,
    status: pedido.status,
    compradorEmail: pedido.comprador_email,
    totalCentavos: pedido.total_centavos,
    itens: (pedido.foto_pedido_itens || []).map((item) => {
      const arquivo = primeiraRelacao(item.foto_arquivos);
      return {
        id: item.id,
        liberado: pedido.status === "pago" && item.download_liberado,
        expiraEm: item.download_expires_at,
        fotoId: arquivo?.id || null,
        titulo: arquivo?.titulo || null,
        mimeType: arquivo?.mime_type || null,
      };
    }),
  }, { headers: { "Cache-Control": "private, no-store" } });
}
