const manifesto = {
  name: "iTatame Fotos",
  short_name: "iTatame Fotos",
  description: "Encontre, compre e baixe suas fotos esportivas.",
  start_url: "/",
  scope: "/",
  display: "standalone",
  background_color: "#050505",
  theme_color: "#050505",
  orientation: "portrait-primary",
  icons: [
    { src: "/fotos-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    { src: "/fotos-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
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
