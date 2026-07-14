import { loadEnvConfig } from "@next/env";
import { fotoIaStorageKey } from "../app/lib/fotos-ai";
import { buscarFotosPorRosto, garantirColecaoRostos } from "../app/lib/rekognition";
import { getR2ObjectBytes } from "../app/lib/r2";
import { createSupabaseServerClient } from "../app/lib/supabase-server";

loadEnvConfig(process.cwd());

async function main() {
  const supabase = createSupabaseServerClient();
  const { data: fotos, error } = await supabase
    .from("foto_arquivos")
    .select("id")
    .eq("status", "publicada")
    .order("created_at", { ascending: true })
    .limit(20);
  if (error) throw new Error(error.message);

  const colecao = await garantirColecaoRostos();
  for (const foto of fotos || []) {
    try {
      const bytes = await getR2ObjectBytes(fotoIaStorageKey(foto.id), 300 * 1024);
      const busca = await buscarFotosPorRosto(bytes);
      const propria = busca.matches.find((match) => match.fotoId === foto.id);
      if (!propria) throw new Error(`A foto ${foto.id} nao retornou na propria busca.`);
      console.log(`[fotos-ia] OK. Colecao ${colecao.collectionId}, modelo ${colecao.modelVersion || "atual"}, ${colecao.faceCount ?? "?"} vetores, foto ${foto.id}, similaridade ${propria.similarity.toFixed(2)}%.`);

      if (process.argv.includes("--api")) {
        const form = new FormData();
        form.append("imagem", new Blob([bytes], { type: "image/jpeg" }), "verificacao.jpg");
        const baseUrl = process.env.FOTOS_BASE_URL || "http://localhost:3000";
        const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/fotos/buscar-por-face`, { method: "POST", body: form });
        const data = await response.json() as { resultados?: Array<{ id: string; similaridade: number }>; error?: string };
        if (!response.ok) throw new Error(data.error || `API respondeu ${response.status}.`);
        const resultadoApi = data.resultados?.find((resultado) => resultado.id === foto.id);
        if (!resultadoApi) throw new Error("A API nao retornou a foto piloto.");
        console.log(`[fotos-ia] API OK. Foto piloto retornada com ${resultadoApi.similaridade.toFixed(2)}%.`);
      }
      return;
    } catch (erroFoto: unknown) {
      const status = erroFoto instanceof Error && "status" in erroFoto ? (erroFoto as Error & { status?: number }).status : null;
      if (status === 404) continue;
      throw erroFoto;
    }
  }

  throw new Error("Nenhuma miniatura indexada foi encontrada para verificacao.");
}

main().catch((error: unknown) => {
  console.error(`[fotos-ia] Verificacao falhou: ${error instanceof Error ? error.message : "erro desconhecido"}`);
  process.exitCode = 1;
});
