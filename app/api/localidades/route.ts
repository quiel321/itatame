import { NextResponse } from "next/server";
import municipios from "@/app/data/municipios-ibge.json";

// Lista oficial obtida da API de localidades do IBGE em 15/10/2026.
// Mantida com a aplicação para não bloquear cadastros quando o IBGE está indisponível.
export async function GET() {
  return NextResponse.json(municipios, {
    headers: { "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" },
  });
}
