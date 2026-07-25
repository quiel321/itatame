import { ImageResponse } from "next/og";

export const alt = "Retratt - Encontre suas fotos. Reviva seus momentos.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  const fotosUrl = process.env.NEXT_PUBLIC_FOTOS_URL || "https://fotos.itatame.com.br";
  const logoUrl = new URL("/retratt/logo-white.png", fotosUrl).toString();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          background: "linear-gradient(135deg, #050505 0%, #18100c 52%, #020202 100%)",
          color: "white",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            width: 560,
            height: 560,
            right: -80,
            top: -120,
            borderRadius: 560,
            background: "rgba(255, 90, 31, 0.22)",
            filter: "blur(12px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 360,
            height: 360,
            right: 120,
            bottom: -160,
            borderRadius: 360,
            background: "rgba(255, 90, 31, 0.10)",
          }}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            padding: "64px 72px",
            position: "relative",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <img src={logoUrl} alt="Retratt" width="320" height="78" style={{ objectFit: "contain" }} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", maxWidth: 820 }}>
            <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: 6, color: "#ff5a1f" }}>
              FOTOGRAFIA DE EVENTOS, SEM FRONTEIRAS
            </span>
            <div style={{ display: "flex", flexDirection: "column", marginTop: 18, fontSize: 67, lineHeight: 1.02, fontWeight: 900, letterSpacing: -2 }}>
              <span>ENCONTRE SUAS FOTOS.</span>
              <span style={{ color: "#ff5a1f" }}>REVIVA SEUS MOMENTOS.</span>
            </div>
            <span style={{ marginTop: 26, fontSize: 25, color: "#d4d4d8" }}>
              Esportes, celebrações, shows e experiências em um só lugar.
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 19, color: "#a1a1aa" }}>
            <span style={{ width: 9, height: 9, borderRadius: 9, background: "#ff5a1f" }} />
            Tecnologia. Velocidade. Emoção.
          </div>
        </div>
      </div>
    ),
    size,
  );
}
