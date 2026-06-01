"use client"

import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import Link from "next/link"

export default function SuperAdminInscricoesPage() {
  const [inscricoes, setInscricoes] = useState<any[]>([])
  
  // ESTADOS DE FILTRO
  const [filtroFaixa, setFiltroFaixa] = useState("")
  const [filtroCategoria, setFiltroCategoria] = useState("")
  const [filtroNome, setFiltroNome] = useState("")
  const [filtroEquipe, setFiltroEquipe] = useState("")

  useEffect(() => {
    async function carregarInscricoes() {
      // Como é painel Super Admin, puxamos TUDO sem filtrar evento
      const { data, error } = await supabase
        .from("inscricoes")
        .select("*")
        .order("id", { ascending: false })

      if (error) {
        console.log(error)
        return
      }
      setInscricoes(data || [])
    }
    carregarInscricoes()
  }, [])

  const inscricoesFiltradas = inscricoes.filter((item) => {
    const faixaOk = filtroFaixa === "" || item.faixa === filtroFaixa
    const categoriaOk = filtroCategoria === "" || item.categoria === filtroCategoria
    const nomeOk = item.atleta?.toLowerCase().includes(filtroNome.toLowerCase()) || item.nome?.toLowerCase().includes(filtroNome.toLowerCase())
    const equipeOk = filtroEquipe === "" || item.equipe === filtroEquipe

    return faixaOk && categoriaOk && nomeOk && equipeOk
  })

  // Extrair equipes únicas para o select automaticamente
  const equipesUnicas = Array.from(new Set(inscricoes.map(i => i.equipe).filter(Boolean)))

  return (
    <main className="min-h-screen bg-[#050505] text-white p-4 md:p-8 relative overflow-hidden">
      
      {/* BACKGROUND GLOW DE SUPER ADMIN (Mais escuro/Roxo para diferenciar do painel do organizador) */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-900/10 blur-[150px] rounded-full pointer-events-none"></div>

      <div className="max-w-7xl mx-auto relative z-10">

        {/* CABEÇALHO SUPER ADMIN */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-indigo-600 text-white text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md shadow-lg pointer-events-none">
                Acesso Super Admin
              </span>
            </div>
            <h1 className="text-2xl md:text-4xl font-black text-white tracking-tight">Auditoria Global de Atletas</h1>
            <p className="text-zinc-500 text-xs mt-1">Banco de dados mestre de todas as inscrições da plataforma iTatame.</p>
          </div>
          
          <div className="flex items-center gap-2">
             <button className="cursor-pointer bg-white/5 hover:bg-white/10 border border-white/10 text-white text-[10px] md:text-xs font-bold uppercase tracking-widest px-4 py-2.5 rounded-lg transition-colors flex items-center gap-2">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                Exportar CSV
             </button>
          </div>
        </div>

        {/* BARRA DE FILTROS AVANÇADA */}
        <div className="bg-[#0a0a0e]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 mb-6 shadow-xl grid grid-cols-1 md:grid-cols-4 gap-3">
          
          <div className="relative cursor-text">
            <svg className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            <input 
              type="text" 
              placeholder="Buscar atleta..." 
              value={filtroNome} 
              onChange={(e) => setFiltroNome(e.target.value)} 
              className="w-full bg-black/50 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 outline-none focus:border-indigo-500 text-white transition-colors text-xs" 
            />
          </div>

          <div className="relative cursor-pointer">
            <select 
              value={filtroFaixa} 
              onChange={(e) => setFiltroFaixa(e.target.value)} 
              className="cursor-pointer w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2.5 outline-none focus:border-indigo-500 text-white transition-colors appearance-none text-xs font-bold"
            >
              <option value="">Todas as Faixas</option>
              <option value="Branca">Branca</option>
              <option value="Azul">Azul</option>
              <option value="Roxa">Roxa</option>
              <option value="Marrom">Marrom</option>
              <option value="Preta">Preta</option>
            </select>
            <svg className="w-3.5 h-3.5 text-zinc-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
          </div>

          <div className="relative cursor-pointer">
            <select 
              value={filtroCategoria} 
              onChange={(e) => setFiltroCategoria(e.target.value)} 
              className="cursor-pointer w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2.5 outline-none focus:border-indigo-500 text-white transition-colors appearance-none text-xs font-bold"
            >
              <option value="">Todas Categorias</option>
              <option value="Pluma (Até 64.500 kg)">Pluma (Até 64.500 kg)</option>
              <option value="Leve (Até 72.500 kg)">Leve (Até 72.500 kg)</option>
              <option value="Meio Pesado (Até 80.000 kg)">Meio Pesado (Até 80.000 kg)</option>
              <option value="Super Pesado (Até 85.500 kg)">Super Pesado (Até 85.500 kg)</option>
              <option value="Pesadíssimo (Acima de 85.5 kg)">Pesadíssimo (Acima de 85.5 kg)</option>
            </select>
            <svg className="w-3.5 h-3.5 text-zinc-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
          </div>

          <div className="relative cursor-pointer">
            <select 
              value={filtroEquipe} 
              onChange={(e) => setFiltroEquipe(e.target.value)} 
              className="cursor-pointer w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2.5 outline-none focus:border-indigo-500 text-white transition-colors appearance-none text-xs font-bold"
            >
              <option value="">Todas as Equipes</option>
              {equipesUnicas.map((eq: any, idx) => (
                <option key={idx} value={eq}>{eq}</option>
              ))}
            </select>
            <svg className="w-3.5 h-3.5 text-zinc-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
          </div>

        </div>

        {/* TABELA DE DADOS (DATA TABLE PREMIUM) */}
        <div className="bg-[#0a0a0e] border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
          
          {/* Header da Tabela com contador */}
          <div className="px-5 py-4 border-b border-white/5 flex justify-between items-center bg-white/[0.01]">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Registros Encontrados</h2>
            <span className="bg-indigo-500/20 text-indigo-400 text-[10px] font-black px-2.5 py-1 rounded-full">{inscricoesFiltradas.length} ATLETAS</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead className="bg-black/40 border-b border-white/5 text-zinc-500 text-[9px] uppercase tracking-widest font-black">
                <tr>
                  <th className="p-4 pl-5">Atleta</th>
                  <th className="p-4">Equipe</th>
                  <th className="p-4">Faixa</th>
                  <th className="p-4">Categoria / Idade</th>
                  <th className="p-4">Peso</th>
                  <th className="p-4 pr-5 text-center">Status Interno</th>
                </tr>
              </thead>
              
              <tbody className="text-xs text-zinc-300 font-medium">
                {inscricoesFiltradas.length > 0 ? (
                  inscricoesFiltradas.map((item, index) => (
                    <tr key={index} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                      <td className="p-4 pl-5 text-white font-bold group-hover:text-indigo-400 transition-colors">
                        {item.atleta || item.nome}
                      </td>
                      <td className="p-4 text-zinc-400">{item.equipe || "-"}</td>
                      <td className="p-4">
                        <span className="bg-white/10 px-2 py-1 rounded text-[10px] font-bold text-white border border-white/5">
                          {item.faixa}
                        </span>
                      </td>
                      <td className="p-4">
                        {item.categoria} <span className="text-zinc-500">({item.idade || "?"} anos)</span>
                      </td>
                      <td className="p-4">{item.peso} kg</td>
                      <td className="p-4 pr-5 flex items-center justify-center gap-2">
                        {/* Indicadores de raio-X do Super Admin */}
                        <div title={item.pagamento_ok ? "Pagamento Confirmado" : "Pagamento Pendente"} className={`w-2.5 h-2.5 rounded-full ${item.pagamento_ok ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-zinc-700"}`}></div>
                        <div title={item.pesagem_ok ? "Pesagem OK" : "Pesagem Pendente"} className={`w-2.5 h-2.5 rounded-full ${item.pesagem_ok ? "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" : "bg-zinc-700"}`}></div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="p-10 text-center text-zinc-500 font-bold uppercase tracking-widest text-xs border-none">
                      Nenhum registro encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </main>
  )
}