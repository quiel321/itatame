"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/app/lib/supabase"; 
import Link from "next/link";
import { useRouter } from "next/navigation";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { ShieldCheck, Map, Trash2, Users, RefreshCw, Edit3, Trophy, Search, ChevronDown, Activity, Globe, Scale, Medal, Banknote } from "lucide-react";

export default function SuperAdminMasterPage() {
  const router = useRouter()
  
  // ESTADOS DO USUÁRIO MASTER
  const [nomeDono, setNomeDono] = useState("Mestre")
  const [fotoUrl, setFotoUrl] = useState("") 
  const [loadingMaster, setLoadingMaster] = useState(true)

  // ESTADOS DA TABELA GLOBAL E MÉTRICAS
  const [inscricoesGlobais, setInscricoesGlobais] = useState<any[]>([])
  const [eventosGlobais, setEventosGlobais] = useState<any[]>([])
  const [organizadoresAtivos, setOrganizadoresAtivos] = useState(0)
  
  // ESTADOS DE FILTRO DA TABELA
  const [filtroFaixa, setFiltroFaixa] = useState("")
  const [filtroCategoria, setFiltroCategoria] = useState("")
  const [filtroNome, setFiltroNome] = useState("")
  const [filtroEquipe, setFiltroEquipe] = useState("")

  // ESTADOS DO GERADOR DE REGRAS GLOBAIS
  const [showRegrasModal, setShowRegrasModal] = useState(false)
  const [novaRegra, setNovaRegra] = useState({ tipo: 'peso', nome: '', genero: 'Masculino' })

  useEffect(() => {
    async function inicializarMainframe() {
      // 1. BLINDAGEM DE DEUS: Validar quem é o Super Admin logado
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        router.push("/login-organizador");
        return;
      }

      // 🚨 IMPORTANTE: No futuro, crie uma coluna 'role' = 'super_admin' na sua tabela de usuários e descomente a validação abaixo:
      /*
      const { data: adminCheck } = await supabase.from("usuarios").select("role").eq("id", authData.user.id).single();
      if (adminCheck?.role !== 'super_admin') {
        router.push("/acesso-negado"); // Expulsa quem tentar acessar pela URL
        return;
      }
      */

      const { data: perfil } = await supabase.from("perfis").select("nome").eq("id", authData.user.id).maybeSingle();
      if (perfil?.nome) setNomeDono(perfil.nome.split(" ")[0]);

      const { data: atleta } = await supabase.from("atletas").select("foto_url").eq("user_id", authData.user.id).maybeSingle();
      if (atleta?.foto_url) setFotoUrl(atleta.foto_url);

      // 2. VISÃO GLOBAL: Puxar TODAS as inscrições de TODOS os eventos do SaaS
      const { data: inscricoes } = await supabase.from("inscricoes").select("*, eventos(nome)").order("id", { ascending: false });
      if (inscricoes) setInscricoesGlobais(inscricoes);

      // 3. Puxar Eventos e Organizadores para as Métricas
      const { data: eventos } = await supabase.from("eventos").select("id");
      if (eventos) setEventosGlobais(eventos);

      const { count: orgCount } = await supabase.from("organizadores").select("*", { count: 'exact', head: true });
      if (orgCount) setOrganizadoresAtivos(orgCount);
      
      setLoadingMaster(false);
    }
    
    inicializarMainframe();
  }, [router]);

  // Lógica de Filtros Globais
  const inscricoesFiltradas = inscricoesGlobais.filter((item) => {
    const faixaOk = filtroFaixa === "" || item.faixa === filtroFaixa
    const categoriaOk = filtroCategoria === "" || item.categoria === filtroCategoria
    const nomeOk = (item.atleta || "").toLowerCase().includes(filtroNome.toLowerCase()) || (item.equipe || "").toLowerCase().includes(filtroNome.toLowerCase())
    const equipeOk = filtroEquipe === "" || item.equipe === filtroEquipe

    return faixaOk && categoriaOk && nomeOk && equipeOk
  });

  const equipesUnicas = Array.from(new Set(inscricoesGlobais.map(i => i.equipe).filter(Boolean)));
  
  // O Faturamento aqui pode ser real no futuro somando os valores das faturas.
  const totalFaturamento = inscricoesGlobais.length * 90; 

  const exportarCSV = () => { /* MESMO CÓDIGO DO CSV */ }
  const exportarPDF = () => { /* MESMO CÓDIGO DO PDF */ }

  const salvarNovaRegraGlobal = () => {
    // Aqui você enviará para a tabela `categorias_globais` no Supabase
    alert(`Regra de ${novaRegra.tipo.toUpperCase()} [${novaRegra.nome}] adicionada ao Padrão Global com sucesso! Organizadores já podem usá-la.`);
    setNovaRegra({ tipo: 'peso', nome: '', genero: 'Masculino' });
    setShowRegrasModal(false);
  }

  if (loadingMaster) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center text-indigo-500 font-black uppercase tracking-widest text-xs">
        <Activity className="w-10 h-10 animate-pulse mb-4 text-indigo-500" />
        <span className="animate-pulse">Acessando Mainframe Global...</span>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#050505] text-white p-4 md:p-6 lg:p-8 relative overflow-x-hidden selection:bg-indigo-500/30">
      
      {/* BACKGROUND GLOW DE SUPER ADMIN */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-900/15 blur-[150px] rounded-full pointer-events-none"></div>
      <div className="absolute top-[40%] left-[-10%] w-[500px] h-[500px] bg-purple-900/10 blur-[150px] rounded-full pointer-events-none"></div>

      <div className="max-w-7xl mx-auto relative z-10">

        {/* CABEÇALHO DO DASHBOARD (VIP) COM FOTO */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div className="flex items-center gap-4 md:gap-5">
            <div className="shrink-0">
              {fotoUrl ? (
                <img src={fotoUrl} alt="Perfil Super Admin" className="w-16 h-16 md:w-20 md:h-20 rounded-full object-cover border-2 border-indigo-500/50 shadow-[0_0_20px_rgba(99,102,241,0.3)] pointer-events-none" />
              ) : (
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-zinc-900 border-2 border-white/10 flex items-center justify-center text-zinc-600 shadow-lg">
                  <ShieldCheck className="w-8 h-8" />
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="bg-indigo-600 text-white text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md shadow-[0_0_10px_rgba(79,70,229,0.5)] cursor-default flex items-center gap-1.5">
                  <Globe size={12} /> Acesso Super Admin
                </span>
                <span className="flex items-center gap-1.5 text-[9px] text-green-400 font-bold uppercase tracking-widest cursor-default">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> Sistemas Online
                </span>
              </div>
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-black text-white tracking-tight">QG iTatame</h1>
              <p className="text-zinc-400 text-[10px] md:text-sm mt-1 max-w-xl">
                Bem-vindo ao cockpit de controle global, <strong>{nomeDono}</strong>.
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 mt-4 md:mt-0">
            <button onClick={() => supabase.auth.signOut().then(() => router.push('/'))} className="cursor-pointer bg-white/5 hover:bg-white/10 border border-white/10 text-white text-[10px] md:text-xs font-bold uppercase tracking-widest px-4 py-2.5 rounded-lg transition-colors flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
              Encerrar Sessão
            </button>
          </div>
        </div>

        {/* MÉTRICAS GLOBAIS DA PLATAFORMA */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-8">
          <div className="bg-[#0a0a0e]/80 backdrop-blur-md border border-indigo-500/30 rounded-2xl p-4 md:p-5 shadow-[0_0_30px_rgba(99,102,241,0.1)] relative overflow-hidden pointer-events-none">
            <div className="absolute -right-4 -top-4 w-20 h-20 bg-indigo-500/20 blur-2xl rounded-full"></div>
            <p className="text-indigo-400 text-[9px] md:text-[10px] font-black uppercase tracking-widest mb-1">Vol. Financeiro Global</p>
            <h3 className="text-xl md:text-3xl font-black text-white">
              <span className="text-indigo-500 text-sm md:text-lg mr-1">R$</span>{totalFaturamento.toLocaleString('pt-BR')}
            </h3>
          </div>
          <div className="bg-[#0a0a0e]/80 backdrop-blur-md border border-white/10 rounded-2xl p-4 md:p-5 shadow-xl relative overflow-hidden pointer-events-none">
            <p className="text-zinc-500 text-[9px] md:text-[10px] font-black uppercase tracking-widest mb-1">Atletas na Plataforma</p>
            <h3 className="text-xl md:text-3xl font-black text-white">{inscricoesGlobais.length} <span className="text-zinc-600 text-xs md:text-sm font-medium">registros</span></h3>
          </div>
          <div className="bg-[#0a0a0e]/80 backdrop-blur-md border border-white/10 rounded-2xl p-4 md:p-5 shadow-xl relative overflow-hidden pointer-events-none">
            <p className="text-zinc-500 text-[9px] md:text-[10px] font-black uppercase tracking-widest mb-1">Eventos Criados</p>
            <h3 className="text-xl md:text-3xl font-black text-white">{eventosGlobais.length} <span className="text-zinc-600 text-xs md:text-sm font-medium">torneios</span></h3>
          </div>
          <div className="bg-[#0a0a0e]/80 backdrop-blur-md border border-white/10 rounded-2xl p-4 md:p-5 shadow-xl relative overflow-hidden pointer-events-none">
            <p className="text-zinc-500 text-[9px] md:text-[10px] font-black uppercase tracking-widest mb-1">Organizadores Ativos</p>
            <h3 className="text-xl md:text-3xl font-black text-white">{organizadoresAtivos} <span className="text-zinc-600 text-xs md:text-sm font-medium">contas</span></h3>
          </div>
        </div>

        <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3 ml-1 cursor-default">Módulos Exclusivos Super-Admin</h2>
        
        {/* GRID DE ACESSOS RÁPIDOS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-10">
          
          <Link href="/super-admin/organizadores" className="group cursor-pointer relative bg-gradient-to-br from-[#0a0a0e] to-black border border-white/5 hover:border-indigo-500/50 rounded-2xl p-5 md:p-6 transition-all shadow-lg overflow-hidden flex flex-col justify-between min-h-[160px]">
            <div className="absolute right-0 bottom-0 w-24 h-24 bg-indigo-500/5 blur-2xl group-hover:bg-indigo-500/10 transition-colors pointer-events-none"></div>
            <div className="w-10 h-10 bg-indigo-500/10 text-indigo-400 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 group-hover:bg-indigo-500 group-hover:text-white transition-all shadow-[0_0_15px_rgba(99,102,241,0.2)]">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm md:text-base font-black text-white group-hover:text-indigo-300 transition-colors">Homologação de Contas</h3>
              <p className="text-zinc-500 text-[9px] md:text-[10px] font-medium mt-1 leading-relaxed">Aprovar ou bloquear novos organizadores.</p>
            </div>
          </Link>

          {/* O MOTOR DE CATEGORIAS GLOBAIS ESTÁ AQUI */}
          <button onClick={() => setShowRegrasModal(true)} className="text-left group cursor-pointer relative bg-gradient-to-br from-[#0a0a0e] to-black border border-white/5 hover:border-blue-500/50 rounded-2xl p-5 md:p-6 transition-all shadow-lg overflow-hidden flex flex-col justify-between min-h-[160px]">
            <div className="absolute right-0 bottom-0 w-24 h-24 bg-blue-500/5 blur-2xl group-hover:bg-blue-500/10 transition-colors pointer-events-none"></div>
            <div className="w-10 h-10 bg-blue-500/10 text-blue-400 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 group-hover:bg-blue-500 group-hover:text-white transition-all shadow-[0_0_15px_rgba(59,130,246,0.2)]">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm md:text-base font-black text-white group-hover:text-blue-300 transition-colors">Livro de Regras Global</h3>
              <p className="text-zinc-500 text-[9px] md:text-[10px] font-medium mt-1 leading-relaxed">Gerenciar pesos, faixas e idades (IBJJF).</p>
            </div>
          </button>

          <Link href="/admin" className="col-span-2 md:col-span-1 group cursor-pointer relative bg-gradient-to-br from-[#0a0a0e] to-black border border-white/5 hover:border-yellow-500/50 rounded-2xl p-5 md:p-6 transition-all shadow-lg overflow-hidden flex flex-col justify-between min-h-[160px]">
            <div className="absolute right-0 bottom-0 w-24 h-24 bg-yellow-500/5 blur-2xl group-hover:bg-yellow-500/10 transition-colors pointer-events-none"></div>
            <div className="w-10 h-10 bg-yellow-500/10 text-yellow-500 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 group-hover:bg-yellow-500 group-hover:text-black transition-all shadow-[0_0_15px_rgba(234,179,8,0.2)]">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm md:text-base font-black text-white group-hover:text-yellow-400 transition-colors">Acessar Painel Comum</h3>
              <p className="text-zinc-500 text-[9px] md:text-[10px] font-medium mt-1 leading-relaxed">Ir para a visão normal de organizador.</p>
            </div>
          </Link>

          <Link href="/super-admin/fotos" className="col-span-2 md:col-span-1 group cursor-pointer relative bg-gradient-to-br from-[#0a0a0e] to-black border border-cyan-500/20 hover:border-cyan-500/60 rounded-2xl p-5 md:p-6 transition-all shadow-lg overflow-hidden flex flex-col justify-between min-h-[160px]">
            <div className="absolute right-0 bottom-0 w-28 h-28 bg-cyan-500/10 blur-2xl group-hover:bg-cyan-500/20 transition-colors pointer-events-none"></div>
            <div className="w-10 h-10 bg-cyan-500/10 text-cyan-400 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 group-hover:bg-cyan-500 group-hover:text-black transition-all shadow-[0_0_15px_rgba(6,182,212,0.2)]">
              <Banknote className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm md:text-base font-black text-white group-hover:text-cyan-300 transition-colors">Financeiro Itatame Fotos</h3>
              <p className="text-zinc-500 text-[9px] md:text-[10px] font-medium mt-1 leading-relaxed">Comissões, royalties, galerias e repasses.</p>
            </div>
          </Link>
        </div>

        {/* BASE DE DADOS GLOBAL (TABELA DE AUDITORIA) */}
        <div className="bg-[#0a0a0e]/90 backdrop-blur-xl border border-white/10 rounded-3xl p-5 md:p-6 shadow-2xl">
          <div className="flex flex-col md:flex-row md:justify-between items-start md:items-center gap-4 mb-6 border-b border-white/5 pb-4">
            <h2 className="text-lg md:text-xl font-black uppercase tracking-widest text-white flex items-center gap-2 cursor-default">
              <Globe className="w-5 h-5 text-indigo-500" />
              Master Data: Visão Global
            </h2>
            
            <div className="flex gap-2 w-full md:w-auto">
              <button onClick={exportarCSV} className="flex-1 md:flex-none justify-center cursor-pointer bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 text-[9px] md:text-[10px] font-bold uppercase tracking-widest px-4 py-2.5 rounded-lg transition-colors flex items-center gap-1.5">
                Gerar CSV
              </button>
              <button onClick={exportarPDF} className="flex-1 md:flex-none justify-center cursor-pointer bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 text-[9px] md:text-[10px] font-bold uppercase tracking-widest px-4 py-2.5 rounded-lg transition-colors flex items-center gap-1.5">
                Gerar PDF
              </button>
            </div>
          </div>

          {/* BARRA DE FILTROS AVANÇADA */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <div className="relative cursor-text">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input type="text" placeholder="Buscar atleta ou equipe..." value={filtroNome} onChange={(e) => setFiltroNome(e.target.value)} className="w-full bg-black/60 border border-white/5 rounded-xl pl-9 pr-3 py-2.5 outline-none focus:border-indigo-500 text-white transition-colors text-xs" />
            </div>
            <div className="relative cursor-pointer">
              <select value={filtroFaixa} onChange={(e) => setFiltroFaixa(e.target.value)} className="cursor-pointer w-full bg-black/60 border border-white/5 rounded-xl px-3 py-2.5 outline-none focus:border-indigo-500 text-white transition-colors appearance-none text-xs font-bold">
                <option value="">Todas as Faixas</option>
                <option value="Branca">Branca</option>
                <option value="Azul">Azul</option>
                <option value="Roxa">Roxa</option>
                <option value="Marrom">Marrom</option>
                <option value="Preta">Preta</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            <div className="relative cursor-pointer">
              <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)} className="cursor-pointer w-full bg-black/60 border border-white/5 rounded-xl px-3 py-2.5 outline-none focus:border-indigo-500 text-white transition-colors appearance-none text-xs font-bold">
                <option value="">Todas Categorias</option>
                <option value="Pluma (Até 64.500 kg)">Pluma (Até 64.500 kg)</option>
                <option value="Leve (Até 72.500 kg)">Leve (Até 72.500 kg)</option>
                <option value="Pesadíssimo (Acima de 85.5 kg)">Pesadíssimo (Acima de 85.5 kg)</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            <div className="relative cursor-pointer">
              <select value={filtroEquipe} onChange={(e) => setFiltroEquipe(e.target.value)} className="cursor-pointer w-full bg-black/60 border border-white/5 rounded-xl px-3 py-2.5 outline-none focus:border-indigo-500 text-white transition-colors appearance-none text-xs font-bold">
                <option value="">Todas as Equipes</option>
                {equipesUnicas.map((eq: any, idx) => (
                  <option key={idx} value={eq}>{eq}</option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* TABELA GLOBAL */}
          <div className="border border-white/5 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead className="bg-black/80 border-b border-white/5 text-zinc-500 text-[9px] md:text-[10px] uppercase tracking-widest font-black">
                  <tr>
                    <th className="p-4 pl-5">Atleta / Evento</th>
                    <th className="p-4">Equipe</th>
                    <th className="p-4">Faixa</th>
                    <th className="p-4">Categoria / Idade</th>
                    <th className="p-4 pr-5 text-center">Status Interno</th>
                  </tr>
                </thead>
                <tbody className="text-[11px] md:text-xs text-zinc-300 font-medium">
                  {inscricoesFiltradas.length > 0 ? (
                    inscricoesFiltradas.map((item, index) => (
                      <tr key={index} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                        <td className="p-4 pl-5">
                          <div className="text-white font-bold group-hover:text-indigo-400 transition-colors">{item.atleta || item.nome}</div>
                          <div className="text-[9px] text-zinc-500 uppercase mt-0.5">{item.eventos?.nome || "Evento Desconhecido"}</div>
                        </td>
                        <td className="p-4 text-zinc-400">{item.equipe || "-"}</td>
                        <td className="p-4">
                          <span className="bg-white/10 px-2 py-1 rounded text-[9px] font-bold text-white border border-white/5 pointer-events-none">
                            {item.faixa}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="text-white">{item.categoria}</div>
                          <div className="text-[9px] text-zinc-500 uppercase mt-0.5">{item.idade || "?"} anos • {item.peso} kg</div>
                        </td>
                        <td className="p-4 pr-5 flex items-center justify-center gap-2 h-full min-h-[50px]">
                          <div title={item.pagamento_ok ? "Pagamento Confirmado" : "Pagamento Pendente"} className={`w-2.5 h-2.5 rounded-full ${item.pagamento_ok ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]"}`}></div>
                          <div title={item.pesagem_ok ? "Pesagem OK" : "Pesagem Pendente"} className={`w-2.5 h-2.5 rounded-full ${item.pesagem_ok ? "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" : "bg-zinc-700"}`}></div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="p-10 text-center text-zinc-500 font-bold uppercase tracking-widest text-[10px] border-none cursor-default">
                        Nenhum registro encontrado no banco de dados global.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* MODAL DO LIVRO DE REGRAS GLOBAIS (Gerador de Categorias)                  */}
      {/* ========================================================================= */}
      {showRegrasModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 md:p-6 bg-black/95 backdrop-blur-md animate-in fade-in zoom-in duration-300">
          <div className="bg-[#0e0e12] border border-blue-500/20 rounded-2xl md:rounded-3xl w-full max-w-2xl shadow-2xl relative overflow-hidden flex flex-col">
            
            <div className="p-5 md:p-6 border-b border-white/5 relative z-10 shrink-0 bg-[#050816]">
              <div className="flex items-center gap-3 mb-2">
                <Scale className="w-6 h-6 text-blue-500" />
                <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight">Livro de Regras</h2>
              </div>
              <p className="text-zinc-400 text-xs mt-1">Crie as categorias oficiais. Elas aparecerão para todos os organizadores.</p>
              <button onClick={() => setShowRegrasModal(false)} className="absolute top-6 right-6 p-2 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white rounded-lg transition-colors cursor-pointer">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>

            <div className="p-5 md:p-6 bg-black/40">
              <div className="flex gap-2 mb-6">
                <button onClick={() => setNovaRegra({...novaRegra, tipo: 'peso'})} className={`flex-1 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all border ${novaRegra.tipo === 'peso' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' : 'bg-black/50 text-zinc-500 border-white/5 hover:text-white'}`}>Categoria de Peso</button>
                <button onClick={() => setNovaRegra({...novaRegra, tipo: 'idade'})} className={`flex-1 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all border ${novaRegra.tipo === 'idade' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' : 'bg-black/50 text-zinc-500 border-white/5 hover:text-white'}`}>Idade / Divisão</button>
                <button onClick={() => setNovaRegra({...novaRegra, tipo: 'faixa'})} className={`flex-1 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all border ${novaRegra.tipo === 'faixa' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' : 'bg-black/50 text-zinc-500 border-white/5 hover:text-white'}`}>Faixa Oficial</button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-zinc-500 text-[10px] font-black uppercase tracking-widest block mb-1.5 ml-1">Gênero Alvo</label>
                    <select value={novaRegra.genero} onChange={(e) => setNovaRegra({...novaRegra, genero: e.target.value})} className="w-full bg-[#050505] border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-blue-500 text-white text-xs font-bold appearance-none cursor-pointer">
                      <option value="Masculino">Masculino</option>
                      <option value="Feminino">Feminino</option>
                      <option value="Ambos">Ambos</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-zinc-500 text-[10px] font-black uppercase tracking-widest block mb-1.5 ml-1">Nome da Regra</label>
                    <input type="text" value={novaRegra.nome} onChange={(e) => setNovaRegra({...novaRegra, nome: e.target.value})} placeholder={novaRegra.tipo === 'peso' ? 'Ex: Leve (Até 76kg)' : novaRegra.tipo === 'faixa' ? 'Ex: Faixa Preta' : 'Ex: Master 1 (30 a 35 anos)'} className="w-full bg-[#050505] border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-blue-500 text-white text-xs placeholder:text-zinc-700" />
                  </div>
                </div>

                <button onClick={salvarNovaRegraGlobal} disabled={!novaRegra.nome} className="w-full mt-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-3.5 rounded-xl font-black uppercase tracking-widest text-xs transition-colors shadow-[0_0_15px_rgba(59,130,246,0.3)]">
                  Adicionar ao Livro Oficial
                </button>
              </div>
            </div>

            <div className="p-4 bg-blue-900/10 border-t border-blue-500/20 text-center">
              <p className="text-blue-400/80 text-[10px] uppercase font-bold tracking-widest">A tabela de 'categorias_globais' deve ser criada no Supabase para salvar estes dados.</p>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}
