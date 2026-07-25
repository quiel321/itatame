const manifesto = {
  name: "Retratt — Suas fotos, seus momentos",
  short_name: "Retratt",
  description: "Encontre, compre e baixe suas fotos de eventos.",
  start_url: "/",
  scope: "/",
  display: "standalone",
  background_color: "#050505",
  theme_color: "#ff5a1f",
  orientation: "portrait-primary",
  icons: [
    { src: "/retratt/app-icon.png", sizes: "1024x1024", type: "image/png", purpose: "any" },
    { src: "/retratt/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
};

export function GET() {
  return Response.json(manifesto, {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
