"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/app/lib/supabase" 
import Link from "next/link"
import { useRouter } from "next/navigation"

// IMPORTAÇÕES PARA GERAR O PDF E CSV
import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"

export default function SuperAdminMasterPage() {
  const router = useRouter()
  
  // ESTADOS DO USUÁRIO MASTER
  const [nomeDono, setNomeDono] = useState("Mestre")
  const [fotoUrl, setFotoUrl] = useState("") // NOVO: Estado da foto
  const [loadingMaster, setLoadingMaster] = useState(true)

  // ESTADOS DA TABELA DE INSCRIÇÕES
  const [inscricoes, setInscricoes] = useState<any[]>([])
  
  // ESTADOS DE FILTRO DA TABELA
  const [filtroFaixa, setFiltroFaixa] = useState("")
  const [filtroCategoria, setFiltroCategoria] = useState("")
  const [filtroNome, setFiltroNome] = useState("")
  const [filtroEquipe, setFiltroEquipe] = useState("")

  useEffect(() => {
    async function inicializarSistema() {
      // 1. Validar quem é o Super Admin logado
      const { data: authData } = await supabase.auth.getUser();
      if (authData.user) {
        const { data: perfil } = await supabase.from("perfis").select("nome").eq("id", authData.user.id).single();
        if (perfil?.nome) setNomeDono(perfil.nome.split(" ")[0]);

        // NOVO: Puxa a foto do Super Admin da tabela de atletas
        const { data: atleta } = await supabase.from("atletas").select("foto_url").eq("user_id", authData.user.id).single();
        if (atleta?.foto_url) setFotoUrl(atleta.foto_url);

      } else {
        router.push("/login-organizador");
        return;
      }

      // 2. Puxar todas as inscrições globais da plataforma
      const { data, error } = await supabase
        .from("inscricoes")
        .select("*")
        .order("id", { ascending: false })

      if (!error && data) {
        setInscricoes(data)
      }
      
      setLoadingMaster(false)
    }
    
    inicializarSistema()
  }, [router])

  // Lógica de Filtros da Tabela
  const inscricoesFiltradas = inscricoes.filter((item) => {
    const faixaOk = filtroFaixa === "" || item.faixa === filtroFaixa
    const categoriaOk = filtroCategoria === "" || item.categoria === filtroCategoria
    const nomeOk = item.atleta?.toLowerCase().includes(filtroNome.toLowerCase()) || item.nome?.toLowerCase().includes(filtroNome.toLowerCase())
    const equipeOk = filtroEquipe === "" || item.equipe === filtroEquipe

    return faixaOk && categoriaOk && nomeOk && equipeOk
  })

  const equipesUnicas = Array.from(new Set(inscricoes.map(i => i.equipe).filter(Boolean)))

  const totalAtletas = inscricoes.length;
  const totalFaturamento = inscricoes.length * 90; 

  const exportarCSV = () => {
    if (inscricoesFiltradas.length === 0) return alert("Nenhum dado para exportar.");
    const headers = ["Atleta", "Equipe", "Faixa", "Categoria", "Idade", "Peso", "Status Pagamento", "Status Pesagem"];
    const csvRows = inscricoesFiltradas.map(i => [
      `"${i.atleta || i.nome || '-'}"`, `"${i.equipe || '-'}"`, `"${i.faixa || '-'}"`, `"${i.categoria || '-'}"`,
      `"${i.idade || '-'}"`, `"${i.peso || '0'} kg"`, `"${i.pagamento_ok ? 'Pago' : 'Pendente'}"`, `"${i.pesagem_ok ? 'Pesado' : 'Pendente'}"`
    ].join(","));
    const csvContent = ["\uFEFF" + headers.join(","), ...csvRows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "auditoria_global_itatame.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const exportarPDF = () => {
    if (inscricoesFiltradas.length === 0) return alert("Nenhum dado para exportar.");
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Relatório de Auditoria Global - iTatame", 14, 20);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const dataAtual = new Date().toLocaleDateString('pt-BR');
    doc.text(`Data do relatório: ${dataAtual}`, 14, 28);
    doc.text(`Total de registros: ${inscricoesFiltradas.length}`, 14, 34);
    const tableColumn = ["Atleta", "Equipe", "Faixa", "Categoria", "Peso", "Status"];
    const tableRows: any[] = [];
    inscricoesFiltradas.forEach(i => {
      const status = `${i.pagamento_ok ? 'Pago' : 'Pen.'} | ${i.pesagem_ok ? 'Pesado' : 'Ñ P.'}`;
      tableRows.push([ i.atleta || i.nome || "-", i.equipe || "-", i.faixa || "-", `${i.categoria} (${i.idade || '?'}y)`, `${i.peso || '0'}kg`, status ]);
    });
    autoTable(doc, { head: [tableColumn], body: tableRows, startY: 40, theme: 'grid', styles: { fontSize: 8, cellPadding: 3 }, headStyles: { fillColor: [99, 102, 241], textColor: [255, 255, 255], fontStyle: 'bold' }, alternateRowStyles: { fillColor: [245, 245, 245] } });
    doc.save("auditoria_global_itatame.pdf");
  }

  if (loadingMaster) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center text-indigo-500 font-black uppercase tracking-widest text-xs">
        <svg className="w-5 h-5 animate-spin mr-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
        Acessando Mainframe...
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#050505] text-white p-4 md:p-6 lg:p-8 relative overflow-x-hidden">
      
      {/* BACKGROUND GLOW DE SUPER ADMIN (Índigo e Roxo Tech) */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-900/15 blur-[150px] rounded-full pointer-events-none"></div>
      <div className="absolute top-[40%] left-[-10%] w-[500px] h-[500px] bg-purple-900/10 blur-[150px] rounded-full pointer-events-none"></div>

      <div className="max-w-7xl mx-auto relative z-10">

        {/* CABEÇALHO DO DASHBOARD (VIP) COM FOTO */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div className="flex items-center gap-4 md:gap-5">
            {/* AVATAR DO SUPER ADMIN */}
            <div className="shrink-0">
              {fotoUrl ? (
                <img 
                  src={fotoUrl} 
                  alt="Perfil Super Admin" 
                  className="w-16 h-16 md:w-20 md:h-20 rounded-full object-cover border-2 border-indigo-500/50 shadow-[0_0_20px_rgba(99,102,241,0.3)] pointer-events-none" 
                />
              ) : (
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-zinc-900 border-2 border-white/10 flex items-center justify-center text-zinc-600 shadow-lg">
                  <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="bg-indigo-600 text-white text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md shadow-[0_0_10px_rgba(79,70,229,0.5)] cursor-default">
                  Acesso Super Admin
                </span>
                <span className="flex items-center gap-1.5 text-[9px] text-green-400 font-bold uppercase tracking-widest cursor-default">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                  Sistemas Online
                </span>
              </div>
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-black text-white tracking-tight">QG iTatame</h1>
              <p className="text-zinc-400 text-[10px] md:text-sm mt-1 max-w-xl">
                Bem-vindo ao cockpit de controle, <strong>{nomeDono}</strong>.
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

        {/* MÉTRICAS GLOBAIS DE ALTO NÍVEL */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-8">
          <div className="bg-[#0a0a0e]/80 backdrop-blur-md border border-white/10 rounded-2xl p-4 md:p-5 shadow-xl relative overflow-hidden pointer-events-none">
            <div className="absolute -right-4 -top-4 w-20 h-20 bg-indigo-500/10 blur-2xl rounded-full"></div>
            <p className="text-zinc-500 text-[9px] md:text-[10px] font-black uppercase tracking-widest mb-1">Vol. Financeiro (Est.)</p>
            <h3 className="text-xl md:text-3xl font-black text-white">
              <span className="text-indigo-400 text-sm md:text-lg">R$</span> {totalFaturamento.toLocaleString('pt-BR')}
            </h3>
          </div>
          <div className="bg-[#0a0a0e]/80 backdrop-blur-md border border-white/10 rounded-2xl p-4 md:p-5 shadow-xl relative overflow-hidden pointer-events-none">
            <div className="absolute -right-4 -top-4 w-20 h-20 bg-blue-500/10 blur-2xl rounded-full"></div>
            <p className="text-zinc-500 text-[9px] md:text-[10px] font-black uppercase tracking-widest mb-1">Total de Inscrições</p>
            <h3 className="text-xl md:text-3xl font-black text-white">{totalAtletas} <span className="text-zinc-600 text-xs md:text-sm font-medium">registros</span></h3>
          </div>
          <div className="bg-[#0a0a0e]/80 backdrop-blur-md border border-white/10 rounded-2xl p-4 md:p-5 shadow-xl relative overflow-hidden pointer-events-none">
            <div className="absolute -right-4 -top-4 w-20 h-20 bg-emerald-500/10 blur-2xl rounded-full"></div>
            <p className="text-zinc-500 text-[9px] md:text-[10px] font-black uppercase tracking-widest mb-1">Equipes Ativas</p>
            <h3 className="text-xl md:text-3xl font-black text-white">{equipesUnicas.length} <span className="text-zinc-600 text-xs md:text-sm font-medium">escolas</span></h3>
          </div>
          <div className="bg-[#0a0a0e]/80 backdrop-blur-md border border-white/10 rounded-2xl p-4 md:p-5 shadow-xl relative overflow-hidden pointer-events-none">
            <div className="absolute -right-4 -top-4 w-20 h-20 bg-purple-500/10 blur-2xl rounded-full"></div>
            <p className="text-zinc-500 text-[9px] md:text-[10px] font-black uppercase tracking-widest mb-1">Saúde do Servidor</p>
            <h3 className="text-xl md:text-3xl font-black text-white flex items-center gap-2">
              100% <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
            </h3>
          </div>
        </div>

        <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3 ml-1 cursor-default">Módulos Administrativos</h2>
        
        {/* GRID DE ACESSOS RÁPIDOS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-10">
          <Link href="/admin" className="col-span-2 md:col-span-1 group cursor-pointer relative bg-gradient-to-br from-[#0a0a0e] to-black border border-white/5 hover:border-yellow-500/50 rounded-2xl p-5 md:p-6 transition-all shadow-lg overflow-hidden flex flex-col justify-between min-h-[160px]">
            <div className="absolute right-0 bottom-0 w-24 h-24 bg-yellow-500/5 blur-2xl group-hover:bg-yellow-500/10 transition-colors pointer-events-none"></div>
            <div className="w-10 h-10 bg-yellow-500/10 text-yellow-500 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 group-hover:bg-yellow-500 group-hover:text-black transition-all shadow-[0_0_15px_rgba(234,179,8,0.2)]">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2"></path></svg>
            </div>
            <div>
              <h3 className="text-sm md:text-base font-black text-white group-hover:text-yellow-400 transition-colors">Visão Organizador</h3>
              <p className="text-zinc-500 text-[9px] md:text-[10px] font-medium mt-1 leading-relaxed">Acesse os seus eventos criados.</p>
            </div>
          </Link>

          <div className="group cursor-pointer relative bg-gradient-to-br from-[#0a0a0e] to-black border border-white/5 hover:border-emerald-500/50 rounded-2xl p-5 md:p-6 transition-all shadow-lg overflow-hidden flex flex-col justify-between min-h-[160px]">
            <div className="absolute right-0 bottom-0 w-24 h-24 bg-emerald-500/5 blur-2xl group-hover:bg-emerald-500/10 transition-colors pointer-events-none"></div>
            <div className="w-10 h-10 bg-emerald-500/10 text-emerald-400 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 group-hover:bg-emerald-500 group-hover:text-white transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)]">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </div>
            <div>
              <h3 className="text-sm md:text-base font-black text-white group-hover:text-emerald-400 transition-colors">Financeiro</h3>
              <p className="text-zinc-500 text-[9px] md:text-[10px] font-medium mt-1 leading-relaxed">Repasses e taxas (Em breve).</p>
            </div>
          </div>

          <div className="group cursor-pointer relative bg-gradient-to-br from-[#0a0a0e] to-black border border-white/5 hover:border-blue-500/50 rounded-2xl p-5 md:p-6 transition-all shadow-lg overflow-hidden flex flex-col justify-between min-h-[160px]">
            <div className="absolute right-0 bottom-0 w-24 h-24 bg-blue-500/5 blur-2xl group-hover:bg-blue-500/10 transition-colors pointer-events-none"></div>
            <div className="w-10 h-10 bg-blue-500/10 text-blue-400 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 group-hover:bg-blue-500 group-hover:text-white transition-all shadow-[0_0_15px_rgba(59,130,246,0.2)]">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
            </div>
            <div>
              <h3 className="text-sm md:text-base font-black text-white group-hover:text-blue-400 transition-colors">Parceiros VIP</h3>
              <p className="text-zinc-500 text-[9px] md:text-[10px] font-medium mt-1 leading-relaxed">Gerencie cadastros secundários.</p>
            </div>
          </div>

          {/* O NOVO BOTÃO DE HOMOLOGAÇÃO ESTÁ AQUI */}
          <Link href="/super-admin/organizadores" className="group cursor-pointer relative bg-gradient-to-br from-[#0a0a0e] to-black border border-white/5 hover:border-indigo-500/50 rounded-2xl p-5 md:p-6 transition-all shadow-lg overflow-hidden flex flex-col justify-between min-h-[160px]">
            <div className="absolute right-0 bottom-0 w-24 h-24 bg-indigo-500/5 blur-2xl group-hover:bg-indigo-500/10 transition-colors pointer-events-none"></div>
            <div className="w-10 h-10 bg-indigo-500/10 text-indigo-400 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 group-hover:bg-indigo-500 group-hover:text-white transition-all shadow-[0_0_15px_rgba(99,102,241,0.2)]">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path></svg>
            </div>
            <div>
              <h3 className="text-sm md:text-base font-black text-white group-hover:text-indigo-300 transition-colors">Homologações</h3>
              <p className="text-zinc-500 text-[9px] md:text-[10px] font-medium mt-1 leading-relaxed">Aprovar ou bloquear contas.</p>
            </div>
          </Link>
        </div>

        {/* BASE DE DADOS GLOBAL (TABELA DE AUDITORIA) */}
        <div className="bg-[#0a0a0e]/90 backdrop-blur-xl border border-white/10 rounded-3xl p-5 md:p-6 shadow-2xl">
          <div className="flex flex-col md:flex-row md:justify-between items-start md:items-center gap-4 mb-6 border-b border-white/5 pb-4">
            <h2 className="text-lg md:text-xl font-black uppercase tracking-widest text-white flex items-center gap-2 cursor-default">
              <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"></path></svg>
              Master Data: Auditoria
            </h2>
            
            {/* BOTÕES DE EXPORTAÇÃO */}
            <div className="flex gap-2 w-full md:w-auto">
              <button onClick={exportarCSV} className="flex-1 md:flex-none justify-center cursor-pointer bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 text-[9px] md:text-[10px] font-bold uppercase tracking-widest px-4 py-2.5 rounded-lg transition-colors flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                Gerar CSV
              </button>
              
              <button onClick={exportarPDF} className="flex-1 md:flex-none justify-center cursor-pointer bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-[9px] md:text-[10px] font-bold uppercase tracking-widest px-4 py-2.5 rounded-lg transition-colors flex items-center gap-1.5 shadow-[0_0_10px_rgba(239,68,68,0.1)]">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                Gerar PDF
              </button>
            </div>
          </div>

          {/* BARRA DE FILTROS AVANÇADA */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <div className="relative cursor-text">
              <svg className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
              <input 
                type="text" 
                placeholder="Buscar atleta ou equipe..." 
                value={filtroNome} 
                onChange={(e) => setFiltroNome(e.target.value)} 
                className="w-full bg-black/60 border border-white/5 rounded-xl pl-9 pr-3 py-2.5 outline-none focus:border-indigo-500 text-white transition-colors text-xs" 
              />
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
              <svg className="w-3.5 h-3.5 text-zinc-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </div>
            <div className="relative cursor-pointer">
              <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)} className="cursor-pointer w-full bg-black/60 border border-white/5 rounded-xl px-3 py-2.5 outline-none focus:border-indigo-500 text-white transition-colors appearance-none text-xs font-bold">
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
              <select value={filtroEquipe} onChange={(e) => setFiltroEquipe(e.target.value)} className="cursor-pointer w-full bg-black/60 border border-white/5 rounded-xl px-3 py-2.5 outline-none focus:border-indigo-500 text-white transition-colors appearance-none text-xs font-bold">
                <option value="">Todas as Equipes</option>
                {equipesUnicas.map((eq: any, idx) => (
                  <option key={idx} value={eq}>{eq}</option>
                ))}
              </select>
              <svg className="w-3.5 h-3.5 text-zinc-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </div>
          </div>

          {/* TABELA EM SI */}
          <div className="border border-white/5 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead className="bg-black/80 border-b border-white/5 text-zinc-500 text-[9px] md:text-[10px] uppercase tracking-widest font-black">
                  <tr>
                    <th className="p-4 pl-5">Atleta</th>
                    <th className="p-4">Equipe</th>
                    <th className="p-4">Faixa</th>
                    <th className="p-4">Categoria / Idade</th>
                    <th className="p-4">Peso</th>
                    <th className="p-4 pr-5 text-center">Status Interno</th>
                  </tr>
                </thead>
                <tbody className="text-[11px] md:text-xs text-zinc-300 font-medium">
                  {inscricoesFiltradas.length > 0 ? (
                    inscricoesFiltradas.map((item, index) => (
                      <tr key={index} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                        <td className="p-4 pl-5 text-white font-bold group-hover:text-indigo-400 transition-colors">
                          {item.atleta || item.nome}
                        </td>
                        <td className="p-4 text-zinc-400">{item.equipe || "-"}</td>
                        <td className="p-4">
                          <span className="bg-white/10 px-2 py-1 rounded text-[9px] font-bold text-white border border-white/5 pointer-events-none">
                            {item.faixa}
                          </span>
                        </td>
                        <td className="p-4">
                          {item.categoria} <span className="text-zinc-500 ml-1">({item.idade || "?"} anos)</span>
                        </td>
                        <td className="p-4">{item.peso} kg</td>
                        <td className="p-4 pr-5 flex items-center justify-center gap-2">
                          <div title={item.pagamento_ok ? "Pagamento Confirmado" : "Pagamento Pendente"} className={`w-2 h-2 rounded-full ${item.pagamento_ok ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-zinc-700"}`}></div>
                          <div title={item.pesagem_ok ? "Pesagem OK" : "Pesagem Pendente"} className={`w-2 h-2 rounded-full ${item.pesagem_ok ? "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" : "bg-zinc-700"}`}></div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="p-10 text-center text-zinc-500 font-bold uppercase tracking-widest text-[10px] border-none cursor-default">
                        Nenhum registro correspondente.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </main>
  )
}