import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Evita publicar arquivos que reconstruam o código-fonte original no navegador.
  productionBrowserSourceMaps: false,

  // Reduz informações de implementação expostas nos cabeçalhos HTTP.
  poweredByHeader: false,

  compiler: {
    // Em produção, remove logs informativos do bundle e preserva diagnósticos críticos.
    removeConsole: process.env.NODE_ENV === "production"
      ? { exclude: ["error", "warn"] }
      : false,
  },
};

export default nextConfig;
