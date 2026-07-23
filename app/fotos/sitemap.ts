import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

const fotosUrl = process.env.NEXT_PUBLIC_FOTOS_URL || "https://fotos.itatame.com.br";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const agora = new Date();
  const paginas: MetadataRoute.Sitemap = [
    { url: fotosUrl, lastModified: agora, changeFrequency: "daily", priority: 1 },
    { url: `${fotosUrl}/fotografo`, lastModified: agora, changeFrequency: "monthly", priority: 0.8 },
    { url: `${fotosUrl}/organizador`, lastModified: agora, changeFrequency: "monthly", priority: 0.8 },
    { url: `${fotosUrl}/precos`, lastModified: agora, changeFrequency: "monthly", priority: 0.75 },
  ];

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return paginas;

  try {
    const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
    const { data } = await supabase
      .from("foto_eventos")
      .select("id, data_evento")
      .eq("status", "publicado")
      .order("data_evento", { ascending: false })
      .limit(1000);

    for (const evento of data || []) {
      paginas.push({
        url: `${fotosUrl}/evento/${evento.id}`,
        lastModified: evento.data_evento || agora,
        changeFrequency: "weekly",
        priority: 0.85,
      });
    }
  } catch {
    // O sitemap principal do Fotos continua válido mesmo sem a lista dinâmica de galerias.
  }

  return paginas;
}
