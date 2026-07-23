import { ImageResponse } from "next/og";

export const alt = "iTatame Fotos - Encontre suas fotos esportivas";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          background: "linear-gradient(135deg, #050505 0%, #130607 52%, #020202 100%)",
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
            background: "rgba(239, 35, 45, 0.20)",
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
            background: "rgba(6, 182, 212, 0.16)",
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
            <div style={{ display: "flex", gap: 7, transform: "skewX(-14deg)" }}>
              <span style={{ width: 18, height: 45, borderRadius: 7, background: "#ef232d" }} />
              <span style={{ width: 18, height: 45, borderRadius: 7, background: "#ffffff" }} />
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 22 }}>
              <span style={{ fontSize: 54, fontWeight: 900, letterSpacing: -3 }}>iTATAME</span>
              <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: 12, color: "#ef232d" }}>FOTOS</span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", maxWidth: 820 }}>
            <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: 6, color: "#22d3ee" }}>
              FOTOGRAFIA ESPORTIVA INTELIGENTE
            </span>
            <div style={{ display: "flex", flexDirection: "column", marginTop: 18, fontSize: 67, lineHeight: 1.02, fontWeight: 900, letterSpacing: -2 }}>
              <span>ENCONTRE SUAS FOTOS.</span>
              <span style={{ color: "#ef232d" }}>REVIVA SUAS CONQUISTAS.</span>
            </div>
            <span style={{ marginTop: 26, fontSize: 25, color: "#d4d4d8" }}>
              Galerias oficiais, busca facial e download digital.
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 19, color: "#a1a1aa" }}>
            <span style={{ width: 9, height: 9, borderRadius: 9, background: "#22d3ee" }} />
            fotos.itatame.com.br
          </div>
        </div>
      </div>
    ),
    size,
  );
}
