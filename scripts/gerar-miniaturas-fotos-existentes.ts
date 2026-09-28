import { loadEnvConfig } from "@next/env";
import sharp from "sharp";
import { fotoStoragePath } from "../app/lib/fotos";
import { getR2ObjectBytes, putR2Object } from "../app/lib/r2";
import { createSupabaseServerClient } from "../app/lib/supabase-server";

loadEnvConfig(process.cwd());

type FotoPendente = {
  id: string;
  evento_id: string;
  album_id: string | null;
  r2_preview_key: string | null;
};

const aplicar = process.argv.includes("--apply");
const limiteArg = process.argv.find((arg) => arg.startsWith("--limit="));
const limite = limiteArg ? Number(limiteArg.split("=")[1]) : Number.MAX_SAFE_INTEGER;

async function main() {
  if (!Number.isInteger(limite) || limite <= 0) throw new Error("--limit deve ser um inteiro positivo.");
  const supabase = createSupabaseServerClient();
  const pendentes: FotoPendente[] = [];
  for (let inicio = 0; inicio < limite; inicio += 500) {
    const { data, error } = await supabase.from("foto_arquivos")
      .select("id, evento_id, album_id, r2_preview_key")
      .eq("status", "publicada")
      .like("mime_type", "image/%")
      .is("r2_thumb_key", null)
      .not("r2_preview_key", "is", null)
      .order("id", { ascending: true })
      .range(inicio, Math.min(inicio + 499, limite - 1));
    if (error) throw new Error(error.message);
    pendentes.push(...((data || []) as FotoPendente[]));
    if (!data || data.length < 500) break;
  }

  console.log(`[fotos-thumb] ${pendentes.length} foto(s) sem miniatura. Modo: ${aplicar ? "aplicar" : "simulação"}.`);
  if (!aplicar) return;

  let indice = 0;
  let falhas = 0;
  async function worker() {
    while (indice < pendentes.length) {
      const foto = pendentes[indice++];
      if (!foto.album_id || !foto.r2_preview_key) continue;
      try {
        const preview = await getR2ObjectBytes(foto.r2_preview_key, 10 * 1024 * 1024);
        const miniatura = await sharp(preview).resize(400, 400, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 76, mozjpeg: true }).toBuffer();
        const key = fotoStoragePath(foto.evento_id, foto.album_id, `${foto.id}-thumb`, "thumb.jpg");
        await putR2Object(key, miniatura, "image/jpeg");
        const { error } = await supabase.from("foto_arquivos").update({ r2_thumb_key: key }).eq("id", foto.id).is("r2_thumb_key", null);
        if (error) throw new Error(error.message);
      } catch (error) {
        falhas++;
        console.error(`[fotos-thumb] ${foto.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
  await Promise.all(Array.from({ length: 3 }, () => worker()));
  console.log(`[fotos-thumb] Concluído: ${pendentes.length - falhas} sucesso(s), ${falhas} falha(s).`);
  if (falhas) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(`[fotos-thumb] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
