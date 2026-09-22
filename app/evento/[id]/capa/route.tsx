import { ImageResponse } from "next/og";
import sharp from "sharp";
import { supabase } from "@/app/lib/supabase";

export const runtime = "nodejs";

const LARGURA = 1200;
const ALTURA = 630;

function urlBanner(caminho?: string | null) {
  if (!caminho) return "";
  if (/^https?:\/\//i.test(caminho)) return caminho;
  if (caminho.startsWith("//")) return `https:${caminho}`;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.itatame.com.br";
  return `${baseUrl}${caminho.startsWith("/") ? "" : "/"}${caminho}`;
}

async function bannerEmJpeg(url: string) {
  const resposta = await fetch(url);
  if (!resposta.ok) return null;
  const bruto = Buffer.from(await resposta.arrayBuffer());
  return sharp(bruto)
    .rotate()
    .resize(LARGURA, ALTURA, { fit: "contain", background: "#050505" })
    .jpeg({ quality: 82 })
    .toBuffer();
}

function capaTexto(nome: string, contexto: string) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          background: "#050505",
          color: "white",
          fontFamily: "Arial, sans-serif",
          padding: "48px 56px",
        }}
      >
        <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: 5, color: "#f87171", textTransform: "uppercase" }}>
          iTatame
        </span>
        <span style={{ marginTop: 12, fontSize: 58, fontWeight: 900, lineHeight: 1.05, maxWidth: 1040 }}>
          {nome || "Campeonato"}
        </span>
        {contexto ? (
          <span style={{ marginTop: 16, fontSize: 24, color: "#e4e4e7", fontWeight: 700 }}>{contexto}</span>
        ) : null}
      </div>
    ),
    { width: LARGURA, height: ALTURA },
  );
}

export async function GET(_request: Request, contexto: { params: Promise<{ id: string }> }) {
  const { id } = await contexto.params;
  const { data: evento } = await supabase
    .from("eventos")
    .select("nome, banner_url, cidade, estado, data_evento")
    .eq("id", id)
    .maybeSingle();

  const local = [evento?.cidade, evento?.estado].filter(Boolean).join(" · ");
  const data = evento?.data_evento
    ? new Date(`${evento.data_evento}T12:00:00`).toLocaleDateString("pt-BR")
    : "";
  const linha = [data, local].filter(Boolean).join("  •  ");
  const banner = urlBanner(evento?.banner_url);

  if (banner) {
    try {
      const jpeg = await bannerEmJpeg(banner);
      if (jpeg) {
        return new Response(new Uint8Array(jpeg), {
          headers: {
            "Content-Type": "image/jpeg",
            "Cache-Control": "public, max-age=3600",
          },
        });
      }
    } catch {
      /* o cartão com o nome cobre banner inválido */
    }
  }

  return capaTexto(evento?.nome || "Campeonato", linha);
}
