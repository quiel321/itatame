import { loadEnvConfig } from "@next/env";
import { prepararEIndexarFotoExistente } from "../app/lib/fotos-ai-server";
import { garantirColecaoRostos } from "../app/lib/rekognition";
import { createSupabaseServerClient } from "../app/lib/supabase-server";

loadEnvConfig(process.cwd());

type FotoPendente = { id: string; r2_original_key: string };

function descreverErro(error: unknown) {
  if (error instanceof Error) {
    const detalhes = error as Error & { name?: string; code?: string; $metadata?: unknown };
    return `${detalhes.name || "Error"}${detalhes.code ? `/${detalhes.code}` : ""}: ${detalhes.message || "sem mensagem"} ${detalhes.$metadata ? JSON.stringify(detalhes.$metadata) : ""}`.trim();
  }
  try { return JSON.stringify(error); } catch { return String(error); }
}

function argumentoNumero(nome: string, padrao: number) {
  const prefixo = `--${nome}=`;
  const valor = process.argv.find((arg) => arg.startsWith(prefixo))?.slice(prefixo.length);
  const numero = Number(valor || padrao);
  return Number.isFinite(numero) && numero > 0 ? Math.floor(numero) : padrao;
}

async function carregarFotos() {
  const supabase = createSupabaseServerClient();
  const fotos: FotoPendente[] = [];
  const pagina = 500;

  for (let inicio = 0; ; inicio += pagina) {
    const { data, error } = await supabase
      .from("foto_arquivos")
      .select("id, r2_original_key")
      .eq("status", "publicada")
      .not("r2_original_key", "is", null)
      .order("created_at", { ascending: true })
      .range(inicio, inicio + pagina - 1);
    if (error) throw new Error(error.message);
    fotos.push(...((data || []) as FotoPendente[]));
    if (!data || data.length < pagina) break;
  }

  return fotos;
}

async function main() {
  const force = process.argv.includes("--force");
  const dryRun = process.argv.includes("--dry-run");
  const onlyArg = process.argv.find((arg) => arg.startsWith("--only="))?.slice("--only=".length);
  const only = onlyArg ? new Set(onlyArg.split(",").map((id) => id.trim()).filter(Boolean)) : null;
  const limite = argumentoNumero("limit", Number.MAX_SAFE_INTEGER);
  const concorrencia = Math.min(4, argumentoNumero("concurrency", 2));
  const colecao = await garantirColecaoRostos();
  const todas = await carregarFotos();
  const filtradas = only ? todas.filter((foto) => only.has(foto.id)) : todas;
  const fotos = filtradas.slice(0, limite);

  console.log(`[fotos-ia] Colecao: ${colecao.collectionId} (modelo ${colecao.modelVersion || "atual"})`);
  console.log(`[fotos-ia] Fotos selecionadas: ${fotos.length}/${todas.length}. Concorrencia: ${concorrencia}. Force: ${force}.`);
  if (dryRun) return;

  let proxima = 0;
  let concluidas = 0;
  let puladas = 0;
  let rostos = 0;
  const falhas: Array<{ id: string; erro: string }> = [];

  async function worker() {
    while (true) {
      const indice = proxima++;
      if (indice >= fotos.length) return;
      const foto = fotos[indice];
      try {
        const resultado = await prepararEIndexarFotoExistente(foto, { force });
        concluidas += 1;
        if (resultado.skipped) puladas += 1;
        rostos += resultado.indexedFaces;
        console.log(`[fotos-ia] ${concluidas}/${fotos.length} ${foto.id}: ${resultado.skipped ? "ja indexada" : `${resultado.indexedFaces} rosto(s), ${Math.round(Number(resultado.thumbnailBytes || 0) / 1024)} KB`}`);
      } catch (error: unknown) {
        concluidas += 1;
        const mensagem = descreverErro(error);
        falhas.push({ id: foto.id, erro: mensagem });
        console.error(`[fotos-ia] ${concluidas}/${fotos.length} ${foto.id}: FALHA - ${mensagem}`);
      }
    }
  }

  await Promise.all(Array.from({ length: concorrencia }, () => worker()));
  console.log(`[fotos-ia] Finalizado. Fotos: ${concluidas}. Puladas: ${puladas}. Rostos indexados: ${rostos}. Falhas: ${falhas.length}.`);
  if (falhas.length) {
    console.error(JSON.stringify(falhas, null, 2));
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(`[fotos-ia] Erro fatal: ${descreverErro(error)}`);
  process.exitCode = 1;
});
