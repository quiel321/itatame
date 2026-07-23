import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#050505", color: "white", fontSize: 42, fontWeight: 900, fontStyle: "italic", letterSpacing: -2 }}>
      <span style={{ color: "#ef4444", marginRight: 2 }}>i</span>TATAME
    </div>,
    size,
  );
}
