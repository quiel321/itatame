import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.itatame.com.br";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const agora = new Date();
  const paginas: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: agora, changeFrequency: "daily", priority: 1 },
    { url: `${baseUrl}/ranking`, lastModified: agora, changeFrequency: "daily", priority: 0.8 },
    { url: `${baseUrl}/placar`, lastModified: agora, changeFrequency: "monthly", priority: 0.6 },
    { url: `${baseUrl}/demonstracao`, lastModified: agora, changeFrequency: "monthly", priority: 0.6 },
  ];

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return paginas;

  try {
    const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
    const { data } = await supabase
      .from("eventos")
      .select("id, data_evento")
      .order("data_evento", { ascending: false })
      .limit(500);

    for (const evento of data || []) {
      paginas.push({
        url: `${baseUrl}/evento/${evento.id}`,
        lastModified: evento.data_evento || agora,
        changeFrequency: "weekly",
        priority: 0.75,
      });
    }
  } catch {
    // Mantém as páginas institucionais disponíveis mesmo se o banco estiver temporariamente indisponível.
  }

  return paginas;
}
