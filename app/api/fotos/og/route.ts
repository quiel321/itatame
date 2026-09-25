import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { AlvoOgFotos, capaOgPermitida, carregarDadosOgFotos } from "@/app/lib/fotos-og";

export const runtime = "nodejs";

const LARGURA = 1200;
const ALTURA = 630;
const MAX_BYTES_CAPA = 15 * 1024 * 1024;

function imagemPadrao() {
  const base = process.env.NEXT_PUBLIC_FOTOS_URL || "https://retratt.com";
  return NextResponse.redirect(new URL("/opengraph-image", base), 302);
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const organizador = params.get("organizador");
  const evento = params.get("evento");
  const alvo: AlvoOgFotos | null = organizador
    ? { tipo: "organizador", slug: organizador }
    : evento
      ? { tipo: "evento", eventoId: evento, albumId: params.get("album") }
      : null;
  if (!alvo) return imagemPadrao();

  try {
    const dados = await carregarDadosOgFotos(alvo);
    if (!dados || !capaOgPermitida(dados.capaUrl)) return imagemPadrao();

    const resposta = await fetch(dados.capaUrl, { redirect: "error", signal: AbortSignal.timeout(8000) });
    if (!resposta.ok) return imagemPadrao();
    if (Number(resposta.headers.get("content-length") || 0) > MAX_BYTES_CAPA) return imagemPadrao();
    const bruto = Buffer.from(await resposta.arrayBuffer());
    if (bruto.byteLength > MAX_BYTES_CAPA) return imagemPadrao();

    const jpeg = await sharp(bruto, { limitInputPixels: 80_000_000 })
      .rotate()
      .resize(LARGURA, ALTURA, { fit: "cover", position: "attention" })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer();

    return new Response(new Uint8Array(jpeg), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
      },
    });
  } catch {
    return imagemPadrao();
  }
}
