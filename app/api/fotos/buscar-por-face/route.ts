import { NextResponse } from "next/server";
import { buscarFotosPorRosto } from "@/app/lib/rekognition";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";
import { chaveLocalidade } from "@/app/lib/localidades";

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
    const cidadeInformada = form.get("cidade");
    const eventoId = typeof eventoIdInformado === "string" && eventoIdInformado.trim()
      ? eventoIdInformado.trim()
      : null;
    if (eventoId && !UUID_PATTERN.test(eventoId)) {
      return NextResponse.json({ error: "Galeria inválida para a busca facial." }, { status: 400 });
    }
    const cidadeSelecionada = typeof cidadeInformada === "string" ? cidadeInformada.trim() : "";
    const [cidade, estado] = cidadeSelecionada.split("|");
    if (!eventoId && (!cidade || cidade.length > 120 || (estado && !/^[A-Z]{2}$/.test(estado)))) {
      return NextResponse.json({ error: "Selecione a cidade do evento." }, { status: 400 });
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

    const supabase = createSupabaseServerClient();
    if (!eventoId) {
      const eventosCidade: { id: string }[] = [];
      for (let inicio = 0; ; inicio += 1000) {
        const { data, error: cidadeError } = await supabase.from("foto_eventos")
          .select("id, cidade, estado").eq("status", "publicado")
          .eq("acesso_por_link", false).not("cidade", "is", null)
          .order("id").range(inicio, inicio + 999);
        if (cidadeError) throw new Error(cidadeError.message);
        eventosCidade.push(...(data || []).filter((item) => chaveLocalidade(item.cidade || "", item.estado || "") === chaveLocalidade(cidade, estado)).map((item) => ({ id: item.id })));
        if (!data || data.length < 1000) break;
      }
      if (!eventosCidade.length) return NextResponse.json({ error: "Não há galerias públicas nessa cidade." }, { status: 400 });
      if (eventosCidade.length < 1000) {
        const { count: fotosNaCidade, error: fotosCidadeError } = await supabase.from("foto_arquivos")
          .select("id", { count: "exact", head: true })
          .in("evento_id", eventosCidade.map((evento) => evento.id)).eq("status", "publicada");
        if (fotosCidadeError) throw new Error(fotosCidadeError.message);
        if (!fotosNaCidade) return NextResponse.json({ resultados: [], rostoDetectado: true, confiancaDeteccao: 0 }, { headers: { "Cache-Control": "no-store" } });
      }
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

    const fotos: Array<{
      id: string;
      evento_id: string;
      titulo: string | null;
      preco_centavos: number;
      mime_type: string | null;
      fotografo_id: string | null;
    }> = [];

    for (let inicio = 0; inicio < ids.length; inicio += 100) {
      let consultaFotos = supabase
        .from("foto_arquivos")
        .select("id, evento_id, titulo, preco_centavos, mime_type, fotografo_id")
        .in("id", ids.slice(inicio, inicio + 100))
        .eq("status", "publicada");
      if (eventoId) consultaFotos = consultaFotos.eq("evento_id", eventoId);
      const { data, error } = await consultaFotos;
      if (error) throw new Error(error.message);
      fotos.push(...(data || []));
    }

    const eventoIds = [...new Set(fotos.map((foto) => foto.evento_id))];
    const { data: eventos, error: eventosError } = eventoIds.length
      ? await (() => {
          return supabase.from("foto_eventos").select("id, nome, data_evento, cidade, estado, permite_download_gratis, desconto_combo_qtd, desconto_combo_percentual, descontos_progressivos")
            .in("id", eventoIds).eq("status", "publicado").eq("acesso_por_link", false);
        })()
      : { data: [], error: null };
    if (eventosError) throw new Error(eventosError.message);
    const eventoPorId = new Map((eventos || [])
      .filter((evento) => eventoId || chaveLocalidade(evento.cidade || "", evento.estado || "") === chaveLocalidade(cidade, estado))
      .map((evento) => [evento.id, evento]));

    const fotoPorId = new Map(fotos.map((foto) => [foto.id, foto]));
    const resultados = ids.flatMap((id) => {
      const foto = fotoPorId.get(id);
      if (!foto || !eventoPorId.has(foto.evento_id)) return [];
      const similaridade = melhoresPorFoto.get(id) || 0;
      return [{
        id: foto.id,
        eventoId: foto.evento_id,
        titulo: foto.titulo,
        precoCentavos: foto.preco_centavos,
        mimeType: foto.mime_type,
        fotografoId: foto.fotografo_id,
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
