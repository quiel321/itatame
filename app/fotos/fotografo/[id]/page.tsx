import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Camera, CalendarDays, MapPin, Phone } from "lucide-react";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";
import { nomeCategoriaFotos } from "@/app/lib/fotos-categorias";
import FotosShell from "../../_components/FotosShell";

type Props = { params: Promise<{ id: string }> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  if (!UUID.test(id)) return { title: "Fotógrafo | Retratt" };
  const { data } = await createSupabaseServerClient().from("fotografos")
    .select("nome").eq("id", id).eq("status", "ativo").maybeSingle();
  return { title: `${data?.nome || "Fotógrafo"} | Retratt`, description: "Galerias e contato do fotógrafo na Retratt." };
}

export default async function PerfilFotografoPublico({ params }: Props) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const supabase = createSupabaseServerClient();
  const { data: fotografo } = await supabase.from("fotografos")
    .select("id, user_id, nome, telefone, bio, foto_url, cidade, estado")
    .eq("id", id).eq("status", "ativo").maybeSingle();
  if (!fotografo) notFound();
  const consultaGalerias = await supabase.from("foto_eventos")
    .select("id, nome, categoria, cidade, estado, data_evento, capa_url")
    .eq("created_by", fotografo.user_id).is("organizador_user_id", null)
    .eq("status", "publicado").eq("acesso_por_link", false)
    .order("data_evento", { ascending: false }).limit(100);
  let galerias: { id: string; nome: string; categoria?: string | null; cidade: string | null; estado: string | null; data_evento: string | null; capa_url: string | null }[] = consultaGalerias.data || [];
  if (consultaGalerias.error?.code === "42703") {
    const fallback = await supabase.from("foto_eventos")
      .select("id, nome, cidade, estado, data_evento, capa_url")
      .eq("created_by", fotografo.user_id).is("organizador_user_id", null)
      .eq("status", "publicado").eq("acesso_por_link", false)
      .order("data_evento", { ascending: false }).limit(100);
    galerias = fallback.data || [];
  }
  const telefoneLimpo = String(fotografo.telefone || "").replace(/\D/g, "");

  return <FotosShell><main className="min-h-[70vh] bg-[#050505] px-4 py-8 text-white md:py-12">
    <div className="mx-auto max-w-6xl">
      <Link href="/fotos" className="text-xs text-zinc-400 hover:text-white">← Voltar às galerias</Link>
      <header className="mt-6 flex flex-col gap-5 border-b border-white/10 pb-7 sm:flex-row sm:items-center">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border border-retratt/40 bg-zinc-900">
          {fotografo.foto_url ? <img src={fotografo.foto_url} alt={fotografo.nome || "Fotógrafo"} className="h-full w-full object-cover" /> : <Camera size={36} className="text-retratt" />}
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-retratt">Fotógrafo Retratt</p>
          <h1 className="mt-1 text-2xl font-black md:text-3xl">{fotografo.nome || "Fotógrafo"}</h1>
          {fotografo.bio && <p className="mt-2 max-w-2xl text-sm text-zinc-300">{fotografo.bio}</p>}
          {(fotografo.cidade || fotografo.estado) && <p className="mt-2 flex items-center gap-1 text-xs text-zinc-400"><MapPin size={14} />{fotografo.cidade}{fotografo.estado ? ` / ${fotografo.estado}` : ""}</p>}
        </div>
      </header>
      <section className="py-7">
        <h2 className="mb-4 text-lg font-black">Galerias de {fotografo.nome || "fotógrafo"}</h2>
        {(galerias || []).length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(galerias || []).map((galeria) => <Link key={galeria.id} href={`/fotos/evento/${galeria.id}`} className="overflow-hidden rounded-xl border border-white/10 bg-[#111] hover:border-retratt/50">
            <div className="h-40 bg-zinc-900">{galeria.capa_url && <img src={galeria.capa_url} alt="" className="h-full w-full object-cover" />}</div>
            <div className="space-y-1 p-4"><p className="text-xs font-bold text-retratt">{nomeCategoriaFotos(galeria.categoria)}</p><h3 className="font-bold">{galeria.nome}</h3><p className="flex items-center gap-1 text-xs text-zinc-400"><CalendarDays size={13} />{galeria.data_evento || "Data a informar"} · {galeria.cidade || "Local a informar"}</p></div>
          </Link>)}
        </div> : <p className="text-sm text-zinc-400">Nenhuma galeria pública no momento.</p>}
      </section>
      <footer className="border-t border-white/10 py-6 text-sm text-zinc-300">
        <p className="font-bold">Contato de {fotografo.nome || "fotógrafo"}</p>
        {telefoneLimpo ? <a href={`tel:+${telefoneLimpo.length > 11 ? telefoneLimpo : `55${telefoneLimpo}`}`} className="mt-2 inline-flex items-center gap-2 text-retratt hover:underline"><Phone size={15} />{fotografo.telefone}</a> : <p className="mt-2 text-zinc-500">Telefone ainda não informado.</p>}
      </footer>
    </div>
  </main></FotosShell>;
}
