import { NextResponse } from "next/server";
import { fotoIaNumeroTag } from "@/app/lib/fotos-ai";
import { BUSCA_NUMERO_MODALIDADES, eventoPermiteBuscaPorNumero } from "@/app/lib/fotos-busca-numero";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";

export const runtime = "nodejs";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const JANELA_MS = 10 * 60 * 1000;
const LIMITE_BUSCAS = 30;

type RateEntry = { inicio: number; total: number };
const globalRate = globalThis as typeof globalThis & { __fotoNumeroRate?: Map<string, RateEntry> };
const rateMap = globalRate.__fotoNumeroRate || new Map<string, RateEntry>();
globalRate.__fotoNumeroRate = rateMap;

function podeBuscar(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const agora = Date.now();
  const atual = rateMap.get(ip);
  if (!atual || agora - atual.inicio >= JANELA_MS) {
    rateMap.set(ip, { inicio: agora, total: 1 });
    return true;
  }
  if (atual.total >= LIMITE_BUSCAS) return false;
  atual.total += 1;
  return true;
}

function variantesNumero(valor: unknown) {
  const numero = String(valor || "").replace(/\D/g, "").slice(0, 6);
  if (!numero) return [];
  const semZeros = numero.replace(/^0+(?=\d)/, "");
  return [...new Set([numero, semZeros])];
}

export async function POST(request: Request) {
  try {
    if (!podeBuscar(request)) {
      return NextResponse.json(
        { error: "Muitas buscas em pouco tempo. Aguarde alguns minutos e tente novamente." },
        { status: 429, headers: { "Cache-Control": "no-store" } },
      );
    }

    const body = await request.json();
    const numeros = variantesNumero(body.numero);
    const tags = numeros.map(fotoIaNumeroTag);
    const eventoId = body.eventoId ? String(body.eventoId) : null;
    if (!numeros.length) {
      return NextResponse.json({ error: "Informe um número de 1 a 6 dígitos." }, { status: 400 });
    }
    if (eventoId && !UUID_PATTERN.test(eventoId)) {
      return NextResponse.json({ error: "Galeria inválida para a busca." }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();
    if (eventoId) {
      const { data: evento, error: eventoError } = await supabase
        .from("foto_eventos")
        .select("id, nome, descricao, local")
        .eq("id", eventoId)
        .maybeSingle();
      if (eventoError) throw new Error(eventoError.message);
      if (!evento || !eventoPermiteBuscaPorNumero(evento)) {
        return NextResponse.json(
          { error: `A busca por número está disponível apenas para ${BUSCA_NUMERO_MODALIDADES}.` },
          { status: 422, headers: { "Cache-Control": "no-store" } },
        );
      }
    }

    let consulta = supabase
      .from("foto_arquivos")
      .select("id, evento_id, titulo, preco_centavos, tags")
      .eq("status", "publicada")
      .overlaps("tags", tags)
      .limit(300);
    if (eventoId) consulta = consulta.eq("evento_id", eventoId);

    const { data: fotos, error } = await consulta;
    if (error) throw new Error(error.message);

    const eventoIds = [...new Set((fotos || []).map((foto) => foto.evento_id))];
    const { data: eventos, error: eventosError } = eventoIds.length
      ? await supabase.from("foto_eventos").select("id, nome, descricao, local, data_evento, cidade, estado").in("id", eventoIds)
      : { data: [], error: null };
    if (eventosError) throw new Error(eventosError.message);
    const eventosPermitidos = (eventos || []).filter(eventoPermiteBuscaPorNumero);
    const eventoPorId = new Map(eventosPermitidos.map((evento) => [evento.id, evento]));
    const fotosPermitidas = (fotos || []).filter((foto) => eventoPorId.has(foto.evento_id));

    return NextResponse.json({
      numero: numeros[0],
      resultados: fotosPermitidas.map((foto) => ({
        id: foto.id,
        eventoId: foto.evento_id,
        titulo: foto.titulo,
        precoCentavos: foto.preco_centavos,
        numerosDetectados: (foto.tags || [])
          .filter((tag: string) => tag.startsWith("ia-numero:"))
          .map((tag: string) => tag.slice("ia-numero:".length)),
        evento: eventoPorId.get(foto.evento_id) || null,
      })),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível pesquisar este número." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
