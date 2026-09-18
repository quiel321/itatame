import { ImageResponse } from "next/og";
import { supabase } from "@/app/lib/supabase";

export const alt = "Campeonato iTatame";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.itatame.com.br";

function urlBanner(caminho?: string | null) {
  if (!caminho) return "";
  if (/^https?:\/\//i.test(caminho)) return caminho;
  if (caminho.startsWith("//")) return `https:${caminho}`;
  return `${baseUrl}${caminho.startsWith("/") ? "" : "/"}${caminho}`;
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data: evento } = await supabase
    .from("eventos")
    .select("nome, banner_url, cidade, estado, data_evento")
    .eq("id", id)
    .maybeSingle();

  const capa = urlBanner(evento?.banner_url);
  const local = [evento?.cidade, evento?.estado].filter(Boolean).join(" · ");
  const data = evento?.data_evento
    ? new Date(`${evento.data_evento}T12:00:00`).toLocaleDateString("pt-BR")
    : "";
  const contexto = [data, local].filter(Boolean).join("  •  ");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: "#050505",
          color: "white",
          fontFamily: "Arial, sans-serif",
        }}
      >
        {capa ? (
          <img
            src={capa}
            alt=""
            width={1200}
            height={630}
            style={{ position: "absolute", top: 0, left: 0, width: 1200, height: 630, objectFit: "cover" }}
          />
        ) : (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: 1200,
              height: 630,
              background: "linear-gradient(135deg, #1a0505 0%, #050505 55%, #2a0a0a 100%)",
            }}
          />
        )}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 1200,
            height: 630,
            background: "linear-gradient(180deg, rgba(5,5,5,0.15) 20%, rgba(5,5,5,0.82) 100%)",
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            width: "100%",
            height: "100%",
            padding: "48px 56px",
          }}
        >
          <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: 5, color: "#f87171", textTransform: "uppercase" }}>
            iTatame
          </span>
          <span
            style={{
              marginTop: 12,
              fontSize: 58,
              fontWeight: 900,
              lineHeight: 1.05,
              letterSpacing: -1.5,
              maxWidth: 1040,
            }}
          >
            {evento?.nome || "Campeonato"}
          </span>
          {contexto ? (
            <span style={{ marginTop: 16, fontSize: 24, color: "#e4e4e7", fontWeight: 700 }}>
              {contexto}
            </span>
          ) : null}
        </div>
      </div>
    ),
    size,
  );
}
