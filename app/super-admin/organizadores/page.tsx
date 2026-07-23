"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/app/lib/supabase"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { PLANOS_COMERCIAIS, getPlanoComercial, type PlanoComercialId } from "@/app/lib/planos-comerciais"

export default function AprovarOrganizadoresPage() {
  const router = useRouter()
  const [organizadores, setOrganizadores] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingAcao, setLoadingAcao] = useState<string | null>(null)
  
  // Filtro de status nas abas
  const [abaAtual, setAbaAtual] = useState<"pendente" | "aprovado" | "bloqueado">("pendente")

  useEffect(() => {
    async function carregarDados() {
      // 1. Verifica segurança
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        router.push("/login-organizador");
        return;
      }

      // 2. Busca todos os organizadores da tabela nova
      const { data, error } = await supabase
        .from("organizadores")
        .select("*")
        .order("created_at", { ascending: false })

      if (!error && data) {
        setOrganizadores(data)
      }
      setLoading(false)
    }
    carregarDados()
  }, [router])

  // Função para mudar o status com apenas um clique!
  async function alterarStatus(id: string, novoStatus: "aprovado" | "bloqueado" | "pendente") {
    setLoadingAcao(id);
    
    const { error } = await supabase
      .from("organizadores")
      .update({ status: novoStatus })
      .eq("id", id);

    if (!error) {
      // Atualiza o estado localmente para refletir na tela imediatamente
      setOrganizadores(prev => prev.map(org => org.id === id ? { ...org, status: novoStatus } : org));
    } else {
      alert("Erro ao atualizar o organizador.");
    }
    setLoadingAcao(null);
  }

  async function alterarPlano(id: string, planoId: PlanoComercialId) {
    const plano = getPlanoComercial(planoId)
    setLoadingAcao(id)
    const { error } = await supabase
      .from("organizadores")
      .update({ plano_comercial: plano.id, comissao_percentual: plano.comissaoPercentual })
      .eq("id", id)

    if (error) alert("Erro ao atualizar o plano do organizador.")
    else setOrganizadores(prev => prev.map(org => org.id === id ? { ...org, plano_comercial: plano.id, comissao_percentual: plano.comissaoPercentual } : org))
    setLoadingAcao(null)
  }

  // Filtra os organizadores baseados na aba escolhida
  const listaFiltrada = organizadores.filter(org => org.status === abaAtual);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center text-indigo-500 font-black uppercase tracking-widest text-xs">
        <svg className="w-5 h-5 animate-spin mr-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
        Carregando Módulo...
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#050505] text-white p-4 md:p-6 lg:p-8 relative overflow-x-hidden">
      
      {/* BACKGROUND GLOW */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-900/15 blur-[150px] rounded-full pointer-events-none"></div>

      <div className="max-w-6xl mx-auto relative z-10">
        
        {/* HEADER */}
        <div className="flex items-center gap-4 mb-8 border-b border-white/10 pb-6">
          <Link href="/super-admin" className="cursor-pointer p-2.5 bg-white/5 hover:bg-white/10 rounded-xl transition-colors text-zinc-400 hover:text-white border border-white/5 shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
          </Link>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="bg-indigo-600 text-white text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md shadow-lg pointer-events-none">
                Gestão Master
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">Homologação de Parceiros</h1>
            <p className="text-zinc-400 text-xs mt-1">
              Aprove contas para que possam criar eventos na plataforma iTatame.
            </p>
          </div>
        </div>

        {/* ABAS (PENDENTES / APROVADOS / BLOQUEADOS) */}
        <div className="flex bg-black/60 p-1.5 rounded-xl border border-white/10 mb-8 shadow-inner w-full md:w-max">
          <button 
            onClick={() => setAbaAtual("pendente")}
            className={`cursor-pointer px-6 py-2.5 text-[10px] md:text-xs font-black uppercase tracking-widest transition-all rounded-lg flex items-center gap-2 ${abaAtual === "pendente" ? "bg-yellow-500 text-black shadow-[0_0_15px_rgba(234,179,8,0.4)]" : "text-zinc-500 hover:text-white"}`}
          >
            Fila de Espera
            <span className="bg-black/20 px-1.5 py-0.5 rounded text-[9px]">{organizadores.filter(o => o.status === "pendente").length}</span>
          </button>
          <button 
            onClick={() => setAbaAtual("aprovado")}
            className={`cursor-pointer px-6 py-2.5 text-[10px] md:text-xs font-black uppercase tracking-widest transition-all rounded-lg flex items-center gap-2 ${abaAtual === "aprovado" ? "bg-green-500 text-black shadow-[0_0_15px_rgba(34,197,94,0.4)]" : "text-zinc-500 hover:text-white"}`}
          >
            Aprovados
            <span className="bg-black/20 px-1.5 py-0.5 rounded text-[9px]">{organizadores.filter(o => o.status === "aprovado").length}</span>
          </button>
          <button 
            onClick={() => setAbaAtual("bloqueado")}
            className={`cursor-pointer px-6 py-2.5 text-[10px] md:text-xs font-black uppercase tracking-widest transition-all rounded-lg flex items-center gap-2 ${abaAtual === "bloqueado" ? "bg-red-500 text-black shadow-[0_0_15px_rgba(239,68,68,0.4)]" : "text-zinc-500 hover:text-white"}`}
          >
            Bloqueados
          </button>
        </div>

        {/* LISTA DE CARDS */}
        {listaFiltrada.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center justify-center bg-[#0a0a0e] border border-dashed border-white/10 rounded-3xl mt-4 shadow-xl pointer-events-none">
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a2 2 0 11-4 0 2 2 0 014 0zM15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
            </div>
            <h3 className="text-lg font-black text-zinc-400 mb-1">Nenhum registo aqui.</h3>
            <p className="text-zinc-600 text-xs">A lista de parceiros neste status está vazia.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {listaFiltrada.map((org) => (
              <div key={org.id} className="bg-[#0a0a0e] border border-white/5 hover:border-indigo-500/30 rounded-2xl p-5 shadow-xl transition-all group flex flex-col">
                
                {/* CABEÇALHO DO CARD (FOTO + INFO) */}
                <div className="flex gap-4 items-center mb-5 border-b border-white/5 pb-5">
                  <div className="shrink-0">
                    {org.foto_url ? (
                      <img src={org.foto_url} alt={org.nome} className="w-14 h-14 rounded-full object-cover border-2 border-white/10" />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-zinc-900 border-2 border-white/10 flex items-center justify-center text-zinc-600">
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                      </div>
                    )}
                  </div>
                  <div className="overflow-hidden">
                    <h3 className="font-black text-white text-sm md:text-base truncate">{org.nome}</h3>
                    <p className="text-indigo-400 font-bold text-[10px] uppercase tracking-widest truncate">{org.academia}</p>
                  </div>
                </div>

                {/* CONTATOS */}
                <div className="space-y-2.5 mb-6 flex-1 text-xs">
                  <div className="flex items-center gap-3 bg-black/40 p-2 rounded-lg border border-white/5">
                    <svg className="w-4 h-4 text-zinc-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                    <span className="text-zinc-300 truncate">{org.email}</span>
                  </div>
                  <div className="flex items-center gap-3 bg-black/40 p-2 rounded-lg border border-white/5">
                    <svg className="w-4 h-4 text-zinc-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                    <span className="text-zinc-300">{org.telefone}</span>
                    <a href={`https://wa.me/${org.telefone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="ml-auto text-green-500 hover:bg-green-500/20 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest bg-green-500/10 transition-colors">Chat</a>
                  </div>
                </div>

                <div className="mb-4 rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3">
                  <label className="mb-2 block text-[9px] font-black uppercase tracking-widest text-indigo-300">Plano comercial · somente Super Admin</label>
                  <select value={getPlanoComercial(org.plano_comercial).id} onChange={(event) => alterarPlano(org.id, event.target.value as PlanoComercialId)} disabled={loadingAcao === org.id} className="w-full rounded-lg border border-white/10 bg-black px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-white outline-none disabled:opacity-50">
                    {PLANOS_COMERCIAIS.map((plano) => <option key={plano.id} value={plano.id}>{plano.nome} · {plano.comissaoPercentual}%</option>)}
                  </select>
                </div>

                {/* AÇÕES (BOTÕES) */}
                {abaAtual === "pendente" && (
                  <div className="flex gap-2 mt-auto">
                    <button 
                      onClick={() => alterarStatus(org.id, "aprovado")} 
                      disabled={loadingAcao === org.id}
                      className="cursor-pointer disabled:opacity-50 flex-1 bg-green-600 hover:bg-green-500 text-white font-black uppercase tracking-widest text-[9px] md:text-[10px] py-3 rounded-xl transition-all shadow-[0_0_15px_rgba(22,163,74,0.2)]"
                    >
                      {loadingAcao === org.id ? "..." : "Aprovar"}
                    </button>
                    <button 
                      onClick={() => alterarStatus(org.id, "bloqueado")} 
                      disabled={loadingAcao === org.id}
                      className="cursor-pointer disabled:opacity-50 flex-1 bg-white/5 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 border border-white/5 hover:border-red-500/30 font-black uppercase tracking-widest text-[9px] md:text-[10px] py-3 rounded-xl transition-all"
                    >
                      {loadingAcao === org.id ? "..." : "Bloquear"}
                    </button>
                  </div>
                )}

                {abaAtual === "aprovado" && (
                  <button 
                    onClick={() => alterarStatus(org.id, "bloqueado")} 
                    disabled={loadingAcao === org.id}
                    className="cursor-pointer disabled:opacity-50 w-full bg-black hover:bg-red-500/10 text-red-500 border border-red-500/30 font-black uppercase tracking-widest text-[9px] md:text-[10px] py-3 rounded-xl transition-all"
                  >
                    Revogar Acesso (Bloquear)
                  </button>
                )}

                {abaAtual === "bloqueado" && (
                  <button 
                    onClick={() => alterarStatus(org.id, "aprovado")} 
                    disabled={loadingAcao === org.id}
                    className="cursor-pointer disabled:opacity-50 w-full bg-black hover:bg-green-500/10 text-green-500 border border-green-500/30 font-black uppercase tracking-widest text-[9px] md:text-[10px] py-3 rounded-xl transition-all"
                  >
                    Restaurar Acesso (Aprovar)
                  </button>
                )}

              </div>
            ))}
          </div>
        )}

      </div>
    </main>
  )
}
