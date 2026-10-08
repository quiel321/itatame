import { NextResponse } from "next/server";
import type { Localidade } from "@/app/lib/localidades";

type MunicipioIbge = {
  nome?: string;
  microrregiao?: { mesorregiao?: { UF?: { sigla?: string } } };
  "regiao-imediata"?: { "regiao-intermediaria"?: { UF?: { sigla?: string } } };
};

export async function GET() {
  try {
    const resposta = await fetch("https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome", {
      next: { revalidate: 60 * 60 * 24 * 30 },
      signal: AbortSignal.timeout(10000),
    });
    if (!resposta.ok) throw new Error(`IBGE: ${resposta.status}`);
    const municipios = await resposta.json() as MunicipioIbge[];
    if (!Array.isArray(municipios)) throw new Error("Resposta inválida do IBGE");
    const localidades: Localidade[] = municipios.flatMap((municipio) => {
      const cidade = municipio.nome?.trim();
      const estado = municipio.microrregiao?.mesorregiao?.UF?.sigla
        || municipio["regiao-imediata"]?.["regiao-intermediaria"]?.UF?.sigla;
      return cidade && estado ? [{ cidade, estado }] : [];
    });
    if (localidades.length < 5000) throw new Error("Lista de municípios incompleta");
    return NextResponse.json(localidades, { headers: { "Cache-Control": "public, max-age=86400" } });
  } catch (error) {
    console.error("Consulta de municípios do IBGE:", error);
    return NextResponse.json({ error: "Não foi possível carregar os municípios. Tente novamente." }, { status: 503 });
  }
}
