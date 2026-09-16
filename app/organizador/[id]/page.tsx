import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";

export const dynamic = "force-dynamic";

export default async function OrganizadorPublicoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createSupabaseServerClient();
  const { data: organizador } = await supabase.from("organizadores")
    .select("user_id,nome,academia,foto_url,cidade,estado,status")
    .eq("user_id", id).maybeSingle();
  if (!organizador || !["aprovado", "ativo"].includes(organizador.status)) notFound();
  const { data: eventos } = await supabase.from("eventos")
    .select("id,nome,data_evento,cidade,estado,banner_url,status")
    .eq("organizador_id", id).order("data_evento", { ascending: false });
  return <main className="min-h-screen bg-[#050505] px-4 py-12 text-white">
    <div className="mx-auto max-w-5xl">
      <Link href="/" className="text-sm text-zinc-400 hover:text-white">← Início</Link>
      <section className="mt-8 flex flex-wrap items-center gap-5 rounded-2xl border border-white/10 bg-zinc-900/50 p-6">
        {organizador.foto_url ? <img src={organizador.foto_url} alt={`Foto de ${organizador.nome}`} className="h-24 w-24 rounded-full object-cover" />
          : <div className="flex h-24 w-24 items-center justify-center rounded-full bg-red-600 text-3xl font-black">{organizador.nome?.charAt(0) || "O"}</div>}
        <div><p className="text-xs font-black uppercase tracking-widest text-red-400">Organizador</p>
          <h1 className="mt-1 text-3xl font-black">{organizador.nome}</h1>
          <p className="mt-2 text-sm text-zinc-400">{[organizador.academia, organizador.cidade, organizador.estado].filter(Boolean).join(" · ")}</p>
        </div>
      </section>
      <h2 className="mt-10 text-xl font-black">Campeonatos organizados</h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(eventos || []).map(evento => <Link key={evento.id} href={`/evento/${evento.id}`} className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/50 hover:border-red-500/50">
          <img src={evento.banner_url || "/arena.png"} alt="" className="h-36 w-full object-cover" />
          <div className="p-4"><h3 className="font-bold">{evento.nome}</h3><p className="mt-2 text-xs text-zinc-400">{evento.data_evento ? new Date(`${evento.data_evento}T12:00:00`).toLocaleDateString("pt-BR") : "Data a definir"} · {[evento.cidade, evento.estado].filter(Boolean).join("/")}</p></div>
        </Link>)}
      </div>
      {!eventos?.length && <p className="mt-5 text-sm text-zinc-400">Ainda não há campeonatos publicados.</p>}
    </div>
  </main>;
}
