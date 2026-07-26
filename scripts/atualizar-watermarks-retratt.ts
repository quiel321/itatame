import { loadEnvConfig } from "@next/env";
import { gerarPreviewProtegidaRetratt } from "../app/lib/fotos-watermark-server";
import { getR2ObjectBytes, putR2Object } from "../app/lib/r2";
import { createSupabaseServerClient } from "../app/lib/supabase-server";

loadEnvConfig(process.cwd());

type FotoPreview = {
  id: string;
  r2_original_key: string;
  r2_preview_key: string | null;
};

function argumentoNumero(nome: string, padrao: number) {
  const valor = process.argv.find((arg) => arg.startsWith(`--${nome}=`))?.split("=")[1];
  const numero = Number(valor || padrao);
  return Number.isFinite(numero) && numero > 0 ? Math.floor(numero) : padrao;
}

async function carregarFotos() {
  const supabase = createSupabaseServerClient();
  const fotos: FotoPreview[] = [];
  const pagina = 500;
  for (let inicio = 0; ; inicio += pagina) {
    const { data, error } = await supabase
      .from("foto_arquivos")
      .select("id, r2_original_key, r2_preview_key")
      .eq("status", "publicada")
      .not("r2_original_key", "is", null)
      .not("r2_preview_key", "is", null)
      .order("created_at", { ascending: true })
      .range(inicio, inicio + pagina - 1);
    if (error) throw new Error(error.message);
    fotos.push(...((data || []) as FotoPreview[]));
    if (!data || data.length < pagina) break;
  }
  return fotos;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const limite = argumentoNumero("limit", Number.MAX_SAFE_INTEGER);
  const concorrencia = Math.min(4, argumentoNumero("concurrency", 2));
  const fotos = (await carregarFotos()).slice(0, limite);
  console.log(`[retratt-watermark] ${fotos.length} prévia(s); concorrência ${concorrencia}; dry-run ${dryRun}.`);
  if (dryRun) return;

  let proxima = 0;
  let concluidas = 0;
  const falhas: Array<{ id: string; erro: string }> = [];

  async function worker() {
    while (true) {
      const indice = proxima++;
      if (indice >= fotos.length) return;
      const foto = fotos[indice];
      try {
        const original = await getR2ObjectBytes(foto.r2_original_key, 40 * 1024 * 1024);
        const preview = await gerarPreviewProtegidaRetratt(original);
        await putR2Object(foto.r2_preview_key!, preview, "image/jpeg");
        concluidas += 1;
        console.log(`[retratt-watermark] ${concluidas}/${fotos.length} ${foto.id}: ${Math.round(preview.length / 1024)} KB`);
      } catch (error: unknown) {
        concluidas += 1;
        const mensagem = error instanceof Error ? error.message : String(error);
        falhas.push({ id: foto.id, erro: mensagem });
        console.error(`[retratt-watermark] ${concluidas}/${fotos.length} ${foto.id}: FALHA - ${mensagem}`);
      }
    }
  }

  await Promise.all(Array.from({ length: concorrencia }, () => worker()));
  console.log(`[retratt-watermark] Finalizado. Sucesso: ${fotos.length - falhas.length}. Falhas: ${falhas.length}.`);
  if (falhas.length) {
    console.error(JSON.stringify(falhas, null, 2));
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(`[retratt-watermark] Erro fatal: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
