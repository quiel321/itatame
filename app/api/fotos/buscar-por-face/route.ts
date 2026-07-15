import { NextResponse } from "next/server";
import { buscarFotosPorRosto } from "@/app/lib/rekognition";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_SELFIE_BYTES = 1024 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const JANELA_MS = 15 * 60 * 1000;
const LIMITE_BUSCAS = 10;

type RateEntry = { inicio: number; total: number };
const globalRate = globalThis as typeof globalThis & { __fotoFaceRate?: Map<string, RateEntry> };
const rateMap = globalRate.__fotoFaceRate || new Map<string, RateEntry>();
globalRate.__fotoFaceRate = rateMap;

function nomeErro(error: unknown) {
  if (typeof error === "object" && error && "name" in error) return String(error.name);
  return "";
}

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

export async function POST(request: Request) {
  try {
    if (!podeBuscar(request)) {
      return NextResponse.json(
        { error: "Muitas buscas em pouco tempo. Aguarde alguns minutos e tente novamente." },
        { status: 429, headers: { "Cache-Control": "no-store" } },
      );
    }

    const form = await request.formData();
    const imagem = form.get("imagem");
    const eventoIdInformado = form.get("eventoId");
    const eventoId = typeof eventoIdInformado === "string" && eventoIdInformado.trim()
      ? eventoIdInformado.trim()
      : null;
    if (eventoId && !UUID_PATTERN.test(eventoId)) {
      return NextResponse.json({ error: "Galeria inválida para a busca facial." }, { status: 400 });
    }
    if (!(imagem instanceof File)) {
      return NextResponse.json({ error: "Envie uma selfie para iniciar a busca." }, { status: 400 });
    }
    if (!new Set(["image/jpeg", "image/png"]).has(imagem.type)) {
      return NextResponse.json({ error: "A selfie precisa estar em JPG ou PNG." }, { status: 400 });
    }
    if (!imagem.size || imagem.size > MAX_SELFIE_BYTES) {
      return NextResponse.json({ error: "A selfie deve ter no maximo 1 MB." }, { status: 413 });
    }

    const resultado = await buscarFotosPorRosto(Buffer.from(await imagem.arrayBuffer()));
    const melhoresPorFoto = new Map<string, number>();
    for (const match of resultado.matches) {
      if (!UUID_PATTERN.test(match.fotoId)) continue;
      melhoresPorFoto.set(match.fotoId, Math.max(melhoresPorFoto.get(match.fotoId) || 0, match.similarity));
    }

    const ids = [...melhoresPorFoto.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 500)
      .map(([id]) => id);

    if (!ids.length) {
      return NextResponse.json(
        { resultados: [], rostoDetectado: true, confiancaDeteccao: resultado.searchedFaceConfidence || 0 },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const supabase = createSupabaseServerClient();
    const fotos: Array<{
      id: string;
      evento_id: string;
      titulo: string | null;
      preco_centavos: number;
    }> = [];

    for (let inicio = 0; inicio < ids.length; inicio += 100) {
      let consultaFotos = supabase
        .from("foto_arquivos")
        .select("id, evento_id, titulo, preco_centavos")
        .in("id", ids.slice(inicio, inicio + 100))
        .eq("status", "publicada");
      if (eventoId) consultaFotos = consultaFotos.eq("evento_id", eventoId);
      const { data, error } = await consultaFotos;
      if (error) throw new Error(error.message);
      fotos.push(...(data || []));
    }

    const eventoIds = [...new Set(fotos.map((foto) => foto.evento_id))];
    const { data: eventos, error: eventosError } = eventoIds.length
      ? await supabase.from("foto_eventos").select("id, nome, data_evento, cidade, estado").in("id", eventoIds)
      : { data: [], error: null };
    if (eventosError) throw new Error(eventosError.message);
    const eventoPorId = new Map((eventos || []).map((evento) => [evento.id, evento]));

    const fotoPorId = new Map(fotos.map((foto) => [foto.id, foto]));
    const resultados = ids.flatMap((id) => {
      const foto = fotoPorId.get(id);
      if (!foto) return [];
      const similaridade = melhoresPorFoto.get(id) || 0;
      return [{
        id: foto.id,
        eventoId: foto.evento_id,
        titulo: foto.titulo,
        precoCentavos: foto.preco_centavos,
        similaridade,
        nivel: similaridade >= 90 ? "forte" : similaridade >= 82 ? "provavel" : "possivel",
        evento: eventoPorId.get(foto.evento_id) || null,
      }];
    });

    return NextResponse.json(
      { resultados, rostoDetectado: true, confiancaDeteccao: resultado.searchedFaceConfidence || 0 },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error: unknown) {
    const nome = nomeErro(error);
    if (nome === "InvalidParameterException") {
      return NextResponse.json(
        { error: "Nao encontramos um rosto nitido. Use uma foto de frente, bem iluminada e sem outras pessoas." },
        { status: 422, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (nome === "InvalidImageFormatException") {
      return NextResponse.json({ error: "Formato de imagem invalido." }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nao foi possivel realizar a busca facial." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
