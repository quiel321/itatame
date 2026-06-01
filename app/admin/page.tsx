"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";
import imageCompression from 'browser-image-compression';

// IMPORTAÇÕES PARA GERAR O PDF E CSV
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export default function AdminPage() {
  const router = useRouter();
  
  // ESTADOS DO USUÁRIO E PERFIL
  const [currentUserId, setCurrentUserId] = useState("");
  const [organizadorNome, setOrganizadorNome] = useState("Organizador");
  const [fotoUrl, setFotoUrl] = useState("");
  const [isOrganizadorNativo, setIsOrganizadorNativo] = useState(false);
  
  // ESTADOS DO MODAL DE PERFIL
  const [showPerfilModal, setShowPerfilModal] = useState(false);
  const [forceCompletion, setForceCompletion] = useState(false);
  const [savingPerfil, setSavingPerfil] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [perfilData, setPerfilData] = useState({
    nome: "", academia: "", telefone: "", documento: "", cep: "", endereco: "", cidade: "", estado: ""
  });
  const [novaFoto, setNovaFoto] = useState<File | null>(null);
  const [novaFotoPreview, setNovaFotoPreview] = useState("");

  // ESTADOS DO DASHBOARD DE EVENTOS
  const [eventos, setEventos] = useState<any[]>([]);
  const [eventoSelecionado, setEventoSelecionado] = useState<string>("todos");
  const [inscricoes, setInscricoes] = useState<any[]>([]);
  const [busca, setBusca] = useState("");
  const [filtroPagamento, setFiltroPagamento] = useState("todos");
  const [loading, setLoading] = useState(true);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [editando, setEditando] = useState<any>(null);

  // ==========================================
  // 1. CARREGAMENTO INICIAL DO USUÁRIO
  // ==========================================
  useEffect(() => {
    async function carregarDashboard() {
      setLoading(true);
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        router.push("/login-organizador");
        return;
      }
      setCurrentUserId(authData.user.id);

      // PROCURAR O USUÁRIO NA TABELA NOVA (ORGANIZADORES)
      const { data: orgData } = await supabase
        .from("organizadores")
        .select("*")
        .eq("user_id", authData.user.id)
        .maybeSingle();

      if (orgData) {
        setIsOrganizadorNativo(true);
        setOrganizadorNome(orgData.nome.split(" ")[0]);
        if (orgData.foto_url) setFotoUrl(orgData.foto_url);
        
        // Alimenta os dados do formulário de perfil
        setPerfilData({
          nome: orgData.nome || "",
          academia: orgData.academia || "",
          telefone: orgData.telefone || "",
          documento: orgData.documento || "",
          cep: orgData.cep || "",
          endereco: orgData.endereco || "",
          cidade: orgData.cidade || "",
          estado: orgData.estado || "",
        });

        // SE O PERFIL NÃO ESTIVER COMPLETO, FORÇA O POPUP!
        if (orgData.perfil_completo === false) {
          setForceCompletion(true);
          setShowPerfilModal(true);
        }

      } else {
        // Fallback: Se for o Super Admin antigo da tabela Atletas testando o painel
        const { data: perfil } = await supabase.from("perfis").select("nome").eq("id", authData.user.id).maybeSingle();
        if (perfil?.nome) setOrganizadorNome(perfil.nome.split(" ")[0]);

        const { data: atleta } = await supabase.from("atletas").select("foto_url").eq("user_id", authData.user.id).maybeSingle();
        if (atleta?.foto_url) setFotoUrl(atleta.foto_url);
      }

      // CARREGA OS EVENTOS DO ORGANIZADOR
      const { data: meusEventos, error } = await supabase
        .from("eventos")
        .select("id, nome")
        .eq("organizador_id", authData.user.id)
        .order("id", { ascending: false });

      if (!error && meusEventos && meusEventos.length > 0) {
        setEventos(meusEventos);
        setEventoSelecionado(meusEventos[0].id.toString());
      } else {
        setEventos([]);
        setLoading(false);
      }
    }
    carregarDashboard();
  }, [router]);

  // ==========================================
  // 2. CARREGAR INSCRIÇÕES QUANDO O EVENTO MUDA
  // ==========================================
  useEffect(() => {
    async function carregarInscricoes() {
      if (eventos.length === 0) {
        setInscricoes([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      let query = supabase.from("inscricoes").select("*").order("id", { ascending: false });
      
      if (eventoSelecionado === "todos") {
        const meusEventosIds = eventos.map(e => e.id);
        query = query.in("evento_id", meusEventosIds);
      } else {
        query = query.eq("evento_id", eventoSelecionado);
      }

      const { data, error } = await query;
      if (!error) setInscricoes(data || []);
      setLoading(false);
    }
    
    if (eventoSelecionado) {
      carregarInscricoes();
    }
  }, [eventoSelecionado, eventos]);

  // ==========================================
  // 3. LÓGICA DE EDIÇÃO DO PERFIL E FOTO
  // ==========================================
  async function handleNovaFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      let processedFile = file;
      if (file.type === "image/heic" || file.name.toLowerCase().endsWith(".heic")) {
        const heic2any = (await import("heic2any")).default;
        const convertedBlob = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.8 });
        const finalBlob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
        processedFile = new File([finalBlob], file.name.replace(/\.heic$/i, ".jpg"), { type: "image/jpeg" });
      }

      const options = { maxSizeMB: 0.5, maxWidthOrHeight: 800, useWebWorker: true };
      const compressedFile = await imageCompression(processedFile, options);

      setNovaFoto(compressedFile);
      setNovaFotoPreview(URL.createObjectURL(compressedFile));
    } catch (error) {
      console.error("Erro na imagem:", error);
      alert("Erro ao processar a imagem.");
    }
  }

  async function salvarPerfil(e: React.FormEvent) {
    e.preventDefault();
    setSavingPerfil(true);

    try {
      let fotoUrlFinal = fotoUrl;

      // Se ele trocou a foto, fazemos o upload pro Supabase
      if (novaFoto && currentUserId) {
        const fileExt = novaFoto.name.split('.').pop();
        const fileName = `${currentUserId}-${Date.now()}.${fileExt}`;
        const filePath = `organizadores/${fileName}`;

        const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, novaFoto);
        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
        fotoUrlFinal = publicUrlData.publicUrl;
      }

      // Atualiza a tabela com todos os dados e marca como completo
      const { error: updateError } = await supabase
        .from("organizadores")
        .update({
          nome: perfilData.nome,
          academia: perfilData.academia,
          telefone: perfilData.telefone,
          documento: perfilData.documento,
          cep: perfilData.cep,
          endereco: perfilData.endereco,
          cidade: perfilData.cidade,
          estado: perfilData.estado,
          foto_url: fotoUrlFinal,
          perfil_completo: true // A MAGIA ACONTECE AQUI!
        })
        .eq("user_id", currentUserId);

      if (updateError) throw updateError;

      // Atualiza a tela sem recarregar
      setFotoUrl(fotoUrlFinal);
      setOrganizadorNome(perfilData.nome.split(" ")[0]);
      setForceCompletion(false);
      setShowPerfilModal(false);
      alert(forceCompletion ? "Cadastro finalizado com sucesso! Bem-vindo!" : "Perfil atualizado com sucesso!");

    } catch (err) {
      console.error(err);
      alert("Erro ao salvar o perfil.");
    } finally {
      setSavingPerfil(false);
    }
  }

  // ==========================================
  // FUNÇÕES DA TABELA DE ATLETAS
  // ==========================================
  async function toggleStatus(id: string, campo: string, valorAtual: boolean) {
    setLoadingId(id);
    const { error } = await supabase.from("inscricoes").update({ [campo]: !valorAtual }).eq("id", id);
    if (!error) setInscricoes(prev => prev.map(inst => inst.id === id ? { ...inst, [campo]: !valorAtual } : inst));
    setLoadingId(null);
  }

  async function salvarEdicaoAtleta() {
    if (!editando) return;
    setLoadingId(editando.id);
    const { error } = await supabase.from("inscricoes").update({
      equipe: editando.equipe, categoria: editando.categoria, peso: editando.peso, faixa: editando.faixa
    }).eq("id", editando.id);
    if (!error) {
      setInscricoes(prev => prev.map(inst => inst.id === editando.id ? editando : inst));
      setEditando(null);
    }
    setLoadingId(null);
  }

  const inscricoesFiltradas = inscricoes.filter((inst) => {
    const termo = busca.toLowerCase();
    const matchBusca = (inst.atleta && inst.atleta.toLowerCase().includes(termo)) || (inst.equipe && inst.equipe.toLowerCase().includes(termo));
    const matchPagamento = filtroPagamento === "todos" ? true : filtroPagamento === "pagos" ? inst.pagamento_ok === true : inst.pagamento_ok !== true;
    return matchBusca && matchPagamento;
  });

  const totalInscritos = inscricoes.length;
  const totalPagos = inscricoes.filter(i => i.pagamento_ok).length;
  const totalPendentes = totalInscritos - totalPagos;

  const exportarCSV = () => { alert("Exportar CSV em construção"); }
  const exportarPDF = () => { alert("Exportar PDF em construção"); }

  return (
    <main className="min-h-screen bg-[#050505] text-white p-4 md:p-8 relative overflow-hidden font-sans">
      
      <div className="max-w-7xl mx-auto relative z-10">
        
        {/* HEADER DE BOAS VINDAS VIP C/ FOTO */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-white/10">
          <div className="flex items-center gap-4 md:gap-5">
            {/* AVATAR DO ORGANIZADOR */}
            <div className="shrink-0 relative group">
              {fotoUrl ? (
                <img src={fotoUrl} alt="Perfil Organizador" className="w-16 h-16 md:w-20 md:h-20 rounded-full object-cover border-2 border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.3)]" />
              ) : (
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-zinc-900 border-2 border-white/10 flex items-center justify-center text-zinc-600 shadow-lg">
                  <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                </div>
              )}
            </div>
            
            <div>
              <span className="text-yellow-500 text-[9px] md:text-[10px] font-black uppercase tracking-widest bg-yellow-500/10 border border-yellow-500/20 px-2.5 py-1 rounded-md mb-2 inline-block">
                Área Exclusiva
              </span>
              <h1 className="text-2xl md:text-4xl font-black text-white tracking-tight">Olá, {organizadorNome}</h1>
              <p className="text-zinc-500 text-[10px] md:text-sm mt-1">Este é o seu centro de comando operacional.</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 mt-4 md:mt-0 flex-wrap">
            {isOrganizadorNativo && (
              <button onClick={() => setShowPerfilModal(true)} className="cursor-pointer bg-black hover:bg-white/5 border border-white/10 text-zinc-400 hover:text-white text-[9px] md:text-[10px] font-bold uppercase tracking-widest px-3.5 py-2.5 rounded-lg transition-colors flex items-center gap-1.5 shadow-lg">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                Editar perfil
              </button>
            )}

            <button onClick={() => supabase.auth.signOut().then(() => router.push('/'))} className="cursor-pointer bg-[#0e0e12] border border-white/5 hover:bg-white/5 text-zinc-400 hover:text-white text-[9px] md:text-[10px] font-bold uppercase tracking-widest px-3.5 py-2.5 rounded-lg transition-colors flex items-center gap-1.5">
              Sair do Sistema
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* DASHBOARD DE EVENTOS (OCULTO SE FORÇANDO COMPLETAR PERFIL) */}
        {/* ========================================================= */}
        {!forceCompletion && (
          <div className={showPerfilModal ? "opacity-30 blur-sm pointer-events-none transition-all duration-300" : "transition-all duration-300"}>
            
            {/* AÇÕES RÁPIDAS SÓLIDAS */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
              <Link href="/admin/novo-evento" className="group cursor-pointer bg-[#0e0e12] border border-white/5 hover:border-white/20 rounded-2xl p-5 transition-all flex items-center gap-4 shadow-lg">
                <div className="w-12 h-12 bg-black text-red-500 border border-white/5 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-red-600 group-hover:border-red-500 group-hover:text-white transition-all">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"></path></svg>
                </div>
                <div>
                  <h3 className="text-sm md:text-base font-black text-white transition-colors">Lançar Novo Evento</h3>
                  <p className="text-zinc-500 text-[10px] md:text-xs font-medium mt-0.5">Criar campeonato do zero.</p>
                </div>
              </Link>

              <Link href="/admin/chaves" className="group cursor-pointer bg-[#0e0e12] border border-white/5 hover:border-white/20 rounded-2xl p-5 transition-all flex items-center gap-4 shadow-lg">
                <div className="w-12 h-12 bg-black text-yellow-500 border border-white/5 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-yellow-500 group-hover:border-yellow-500 group-hover:text-black transition-all">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                </div>
                <div>
                  <h3 className="text-sm md:text-base font-black text-white transition-colors">Gerador de Chaves</h3>
                  <p className="text-zinc-500 text-[10px] md:text-xs font-medium mt-0.5">Sorteio de lutas automático.</p>
                </div>
              </Link>

              <Link href="/admin/vouchers" className="group cursor-pointer bg-[#0e0e12] border border-white/5 hover:border-white/20 rounded-2xl p-5 transition-all flex items-center gap-4 shadow-lg">
                <div className="w-12 h-12 bg-black text-blue-400 border border-white/5 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-blue-500 group-hover:border-blue-500 group-hover:text-white transition-all">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"></path></svg>
                </div>
                <div>
                  <h3 className="text-sm md:text-base font-black text-white transition-colors">Cortesias / Vouchers</h3>
                  <p className="text-zinc-500 text-[10px] md:text-xs font-medium mt-0.5">Pacotes e vagas de equipes.</p>
                </div>
              </Link>
            </div>

            {/* SESSÃO: GESTÃO DE ATLETAS E EVENTOS */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-white/5 pb-4">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                <h2 className="text-xl font-black uppercase tracking-widest text-white">Gestão de Atletas</h2>
              </div>
              <div className="flex gap-2 w-full md:w-auto">
                <button onClick={exportarCSV} className="flex-1 md:flex-none justify-center cursor-pointer bg-white/5 hover:bg-white/10 border border-white/10 text-white text-[9px] md:text-[10px] font-bold uppercase tracking-widest px-4 py-2.5 rounded-lg transition-colors flex items-center gap-1.5 active:scale-95">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                  Gerar CSV
                </button>
                <button onClick={exportarPDF} className="flex-1 md:flex-none justify-center cursor-pointer bg-red-600/10 hover:bg-red-600/20 border border-red-500/30 text-red-500 text-[9px] md:text-[10px] font-bold uppercase tracking-widest px-4 py-2.5 rounded-lg transition-colors flex items-center gap-1.5 active:scale-95">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                  Gerar PDF
                </button>
              </div>
            </div>

            {/* SELETOR DE EVENTO E BUSCA */}
            <div className="bg-[#0e0e12] border border-white/5 rounded-xl p-3 md:p-4 mb-6 flex flex-col md:flex-row items-center gap-3 shadow-xl">
              <label className="text-zinc-500 font-black uppercase tracking-widest text-[9px] md:text-[10px] shrink-0">Filtro de Campeonato:</label>
              <div className="relative w-full md:w-1/3 cursor-pointer">
                <select value={eventoSelecionado} onChange={(e) => setEventoSelecionado(e.target.value)} className="cursor-pointer w-full bg-black border border-white/5 focus:border-red-500 outline-none rounded-lg px-3 py-3 text-white transition-all appearance-none font-bold text-xs md:text-sm" disabled={eventos.length === 0}>
                  {eventos.length === 0 && <option value="">Nenhum evento criado ainda...</option>}
                  {eventos.length > 0 && <option value="todos">Todos os seus eventos</option>}
                  {eventos.map(ev => <option key={ev.id} value={ev.id.toString()}>🏆 {ev.nome}</option>)}
                </select>
                <svg className="w-4 h-4 text-zinc-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
              </div>

              {eventos.length > 0 && (
                <>
                  <div className="flex-1 relative cursor-text w-full">
                    <svg className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                    <input type="text" placeholder="Buscar atleta ou equipe..." value={busca} onChange={(e) => setBusca(e.target.value)} className="w-full bg-black border border-white/5 rounded-lg pl-9 pr-3 py-3 outline-none focus:border-red-500 text-white transition-colors text-xs" />
                  </div>
                  <div className="w-full md:w-48 relative cursor-pointer">
                    <select value={filtroPagamento} onChange={(e) => setFiltroPagamento(e.target.value)} className="cursor-pointer w-full bg-black border border-white/5 rounded-lg px-3 py-3 outline-none focus:border-red-500 text-white transition-colors appearance-none text-xs font-bold">
                      <option value="todos">Todos os Status</option>
                      <option value="pagos">Somente Pagos</option>
                      <option value="pendentes">Somente Pendentes</option>
                    </select>
                    <svg className="w-3.5 h-3.5 text-zinc-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                  </div>
                </>
              )}
            </div>

            {/* DASHBOARD DE NÚMEROS SÓLIDOS */}
            {eventos.length > 0 && (
              <div className="grid grid-cols-3 gap-3 md:gap-5 mb-8">
                <div className="bg-[#0e0e12] border-t-4 border-t-zinc-600 border-x border-b border-white/5 rounded-2xl p-4 md:p-6 shadow-xl flex flex-col items-center justify-center text-center">
                  <h3 className="text-zinc-500 font-bold uppercase text-[9px] md:text-[11px] tracking-widest mb-1.5">Inscritos</h3>
                  <p className="text-2xl md:text-4xl font-black text-white">{totalInscritos}</p>
                </div>
                <div className="bg-[#0e0e12] border-t-4 border-t-green-500 border-x border-b border-white/5 rounded-2xl p-4 md:p-6 shadow-xl flex flex-col items-center justify-center text-center">
                  <h3 className="text-green-500 font-bold uppercase text-[9px] md:text-[11px] tracking-widest mb-1.5">Pagos</h3>
                  <p className="text-2xl md:text-4xl font-black text-green-400">{totalPagos}</p>
                </div>
                <div className="bg-[#0e0e12] border-t-4 border-t-red-500 border-x border-b border-white/5 rounded-2xl p-4 md:p-6 shadow-xl flex flex-col items-center justify-center text-center">
                  <h3 className="text-red-500 font-bold uppercase text-[9px] md:text-[11px] tracking-widest mb-1.5">Pendentes</h3>
                  <p className="text-2xl md:text-4xl font-black text-red-500">{totalPendentes}</p>
                </div>
              </div>
            )}

            {/* EMPTY STATE - SEM EVENTOS */}
            {!loading && eventos.length === 0 && (
              <div className="py-20 text-center flex flex-col items-center justify-center bg-[#0e0e12] border border-dashed border-white/10 rounded-3xl mt-4 shadow-xl">
                <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-10 h-10 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                </div>
                <h3 className="text-xl font-black text-white mb-2">Nenhum evento criado.</h3>
                <p className="text-zinc-500 text-xs md:text-sm mb-6 max-w-md">Você ainda não organizou nenhum campeonato. Comece agora clicando no botão abaixo.</p>
                <Link href="/admin/novo-evento" className="cursor-pointer bg-red-600 hover:bg-red-500 text-white text-xs font-black uppercase tracking-widest px-8 py-4 rounded-xl shadow-lg transition-all active:scale-95">
                  Criar Meu Primeiro Evento
                </Link>
              </div>
            )}
            
            {/* ========================================================= */}
            {/* GRID DINÂMICO DE CARDS DE ATLETAS (CLEAN DESIGN)          */}
            {/* ========================================================= */}
            {eventos.length > 0 && !loading && (
              inscricoesFiltradas.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5">
                  {inscricoesFiltradas.map((insc) => (
                    <div key={insc.id} className="bg-[#0e0e12] border border-white/5 rounded-2xl p-5 flex flex-col justify-between hover:border-white/20 transition-all shadow-xl h-full relative overflow-hidden group">
                      
                      {/* BARRA DE STATUS NO TOPO */}
                      <div className={`absolute top-0 left-0 w-full h-1.5 ${insc.pagamento_ok ? 'bg-green-500' : 'bg-red-500'}`}></div>

                      <div className="relative z-10 flex-1">
                        {/* Evento e Status (Pills Sólidos) */}
                        <div className="flex items-start justify-between gap-2 mb-4">
                          <span className="bg-black text-zinc-400 text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded border border-white/5 truncate max-w-[120px]" title={insc.eventos?.nome}>
                            {insc.eventos?.nome || "Evento"}
                          </span>
                          <div className="flex flex-col gap-1 items-end shrink-0">
                            <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${insc.pagamento_ok ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}>
                              {insc.pagamento_ok ? 'Pago' : 'Pendente'}
                            </span>
                            <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${insc.pesagem_ok ? "bg-blue-600 text-white" : "bg-zinc-700 text-zinc-300"}`}>
                              {insc.pesagem_ok ? 'Peso OK' : 'S/ Peso'}
                            </span>
                          </div>
                        </div>

                        {/* Nome e Equipe */}
                        <h4 className="text-base md:text-lg font-black text-white uppercase tracking-tight line-clamp-1" title={insc.atleta}>{insc.atleta || "NOME NÃO INFORMADO"}</h4>
                        <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mt-1 line-clamp-1" title={insc.equipe}>{insc.equipe || "SEM EQUIPE"}</p>
                        
                        {/* Detalhes (Faixa, Peso, Cat) */}
                        <div className="flex flex-col gap-1.5 mt-4 mb-5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold text-zinc-300 bg-black px-2.5 py-1.5 rounded-md border border-white/5">🥋 {insc.faixa || "?"}</span>
                            <span className="text-[10px] font-bold text-zinc-300 bg-black px-2.5 py-1.5 rounded-md border border-white/5">⚖️ {insc.peso ? `${insc.peso} KG` : "Abs."}</span>
                          </div>
                          <span className="text-[10px] font-bold text-zinc-400 bg-black border border-white/5 px-2.5 py-1.5 rounded-md truncate w-full" title={insc.categoria}>🏆 {insc.categoria}</span>
                        </div>
                      </div>

                      {/* Botões de Ação sem Neon */}
                      <div className="relative z-10 flex flex-col gap-2 mt-auto">
                        <div className="flex gap-2">
                          <button 
                            onClick={() => toggleStatus(insc.id, 'pagamento_ok', insc.pagamento_ok)}
                            disabled={loadingId === insc.id}
                            className={`cursor-pointer flex-1 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border flex items-center justify-center active:scale-95 ${insc.pagamento_ok ? 'bg-black text-green-500 border-green-500/30 hover:bg-white/5' : 'bg-red-600 text-white border-red-600 hover:bg-red-500'}`}
                          >
                            {loadingId === insc.id ? '...' : insc.pagamento_ok ? 'Desfazer Pag.' : 'Aprovar $$'}
                          </button>

                          <button 
                            onClick={() => toggleStatus(insc.id, 'pesagem_ok', insc.pesagem_ok)}
                            disabled={loadingId === insc.id}
                            className={`cursor-pointer flex-1 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center active:scale-95 border ${insc.pesagem_ok ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-500' : 'bg-black text-zinc-400 border-white/10 hover:text-white hover:bg-white/5'}`}
                          >
                            {loadingId === insc.id ? '...' : insc.pesagem_ok ? 'Peso OK' : 'Confirmar P.'}
                          </button>
                        </div>
                        
                        <button 
                          onClick={() => setEditando(insc)}
                          className="cursor-pointer w-full py-2.5 rounded-lg text-[9px] font-bold text-zinc-500 hover:text-white hover:bg-white/10 transition-colors uppercase tracking-widest active:scale-95 flex items-center justify-center gap-1.5 mt-1 bg-black border border-white/5"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                          Editar Inscrição
                        </button>
                      </div>

                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 bg-[#0e0e12] border border-white/5 rounded-2xl">
                  <p className="text-zinc-500 text-sm font-medium">Nenhum atleta encontrado com os filtros atuais.</p>
                </div>
              )
            )}

          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* MODAL DE EDIÇÃO DE ATLETA RÁPIDA                            */}
      {/* ========================================================= */}
      {editando && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0e0e12] border border-white/10 rounded-3xl w-full max-w-md p-6 shadow-2xl relative overflow-hidden">
            <h3 className="text-xl font-black text-white mb-2 uppercase tracking-tighter relative z-10">Editar Inscrição</h3>
            <p className="text-zinc-400 text-xs mb-6 relative z-10">Alterando dados do atleta <strong className="text-white">{editando.atleta}</strong></p>
            
            <div className="space-y-4 relative z-10">
              <div>
                <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1 block pl-1">Equipe / Academia</label>
                <input type="text" value={editando.equipe || ''} onChange={e => setEditando({...editando, equipe: e.target.value})} className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-red-500 outline-none transition-colors" />
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1 block pl-1">Categoria na Chave</label>
                <input type="text" value={editando.categoria || ''} onChange={e => setEditando({...editando, categoria: e.target.value})} className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-red-500 outline-none transition-colors" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1 block pl-1">Faixa</label>
                  <input type="text" value={editando.faixa || ''} onChange={e => setEditando({...editando, faixa: e.target.value})} className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-red-500 outline-none transition-colors" />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1 block pl-1">Peso Declarado</label>
                  <input type="text" value={editando.peso || ''} onChange={e => setEditando({...editando, peso: e.target.value})} className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-red-500 outline-none transition-colors" />
                </div>
              </div>
            </div>
            
            <div className="flex gap-3 mt-8 relative z-10">
              <button onClick={() => setEditando(null)} className="cursor-pointer flex-1 py-3.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs uppercase tracking-widest transition-colors active:scale-95">Cancelar</button>
              <button onClick={salvarEdicaoAtleta} className="cursor-pointer flex-1 py-3.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase tracking-widest transition-colors active:scale-95">
                {loadingId === editando.id ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL GIGANTE DE CONFIGURAÇÃO DE PERFIL / ONBOARDING      */}
      {/* ========================================================= */}
      {showPerfilModal && (
        <div className={`fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-8 bg-black/95 backdrop-blur-md animate-in fade-in zoom-in duration-300 ${forceCompletion ? 'pointer-events-auto' : ''}`}>
          
          <div className="bg-[#0e0e12] border border-white/10 rounded-3xl w-full max-w-4xl shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">

            {/* Cabeçalho do Modal */}
            <div className="p-6 md:p-8 border-b border-white/5 relative z-10 shrink-0 bg-black/50">
              {forceCompletion && (
                <span className="inline-block bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 text-[9px] md:text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-md mb-3 animate-pulse">
                  Ação Obrigatória
                </span>
              )}
              <h2 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight">
                {forceCompletion ? "Finalize o Seu Cadastro" : "Configurações do Perfil"}
              </h2>
              <p className="text-zinc-500 text-xs md:text-sm mt-1">
                {forceCompletion ? "Preencha os dados abaixo para liberar o acesso total ao seu painel operacional." : "Mantenha as informações da sua organização atualizadas."}
              </p>

              {/* Botão de Fechar */}
              {!forceCompletion && (
                <button onClick={() => setShowPerfilModal(false)} className="absolute top-6 right-6 p-2 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white rounded-xl transition-colors cursor-pointer">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
              )}
            </div>

            {/* Corpo do Formulário */}
            <form onSubmit={salvarPerfil} className="p-6 md:p-8 overflow-y-auto flex-1 custom-scrollbar relative z-10 space-y-8">
              
              {/* SESSÃO 1: FOTO E IDENTIFICAÇÃO */}
              <div>
                <h3 className="text-white font-black text-sm uppercase tracking-widest flex items-center gap-2 mb-4 border-l-2 border-red-500 pl-3">
                  1. Identidade Visual
                </h3>
                <div className="flex flex-col md:flex-row items-center md:items-start gap-6 bg-black/40 p-5 rounded-2xl border border-white/5">
                  <div className="shrink-0 flex flex-col items-center">
                    <div 
                      className="relative w-24 h-24 md:w-32 md:h-32 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center bg-black hover:border-red-500/50 transition-colors cursor-pointer group overflow-hidden shadow-xl"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {novaFotoPreview || fotoUrl ? (
                        <img src={novaFotoPreview || fotoUrl} alt="Preview" className="w-full h-full object-cover rounded-full" />
                      ) : (
                        <svg className="w-10 h-10 text-zinc-600 group-hover:text-red-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      )}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <span className="text-white text-[10px] font-black uppercase tracking-widest text-center px-2">Trocar Foto</span>
                      </div>
                    </div>
                    <input type="file" accept="image/*, .heic" className="hidden" ref={fileInputRef} onChange={handleNovaFoto} />
                  </div>
                  
                  <div className="flex-1 space-y-4 w-full">
                    <div>
                      <label className="text-zinc-500 text-[10px] font-black uppercase tracking-widest block mb-1.5 ml-1">Nome do Gestor Responsável *</label>
                      <input required value={perfilData.nome} onChange={(e) => setPerfilData({...perfilData, nome: e.target.value})} className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-red-500 text-white text-sm" placeholder="Ex: Alex Nunes" />
                    </div>
                    <div>
                      <label className="text-zinc-500 text-[10px] font-black uppercase tracking-widest block mb-1.5 ml-1">Nome da Organização / Evento *</label>
                      <input required value={perfilData.academia} onChange={(e) => setPerfilData({...perfilData, academia: e.target.value})} className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-red-500 text-white text-sm" placeholder="Ex: Copa iTatame" />
                    </div>
                  </div>
                </div>
              </div>

              {/* SESSÃO 2: DOCUMENTAÇÃO E CONTATO */}
              <div>
                <h3 className="text-white font-black text-sm uppercase tracking-widest flex items-center gap-2 mb-4 border-l-2 border-red-500 pl-3">
                  2. Documentação Oficial
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-black/40 p-5 rounded-2xl border border-white/5">
                  <div>
                    <label className="text-zinc-500 text-[10px] font-black uppercase tracking-widest block mb-1.5 ml-1">CPF ou CNPJ (Repasses) *</label>
                    <input required value={perfilData.documento} onChange={(e) => setPerfilData({...perfilData, documento: e.target.value})} className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-red-500 text-white text-sm" placeholder="000.000.000-00" />
                  </div>
                  <div>
                    <label className="text-zinc-500 text-[10px] font-black uppercase tracking-widest block mb-1.5 ml-1">WhatsApp de Suporte *</label>
                    <input required value={perfilData.telefone} onChange={(e) => setPerfilData({...perfilData, telefone: e.target.value})} className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-red-500 text-white text-sm" placeholder="(00) 00000-0000" />
                  </div>
                </div>
              </div>

              {/* SESSÃO 3: LOCALIZAÇÃO */}
              <div>
                <h3 className="text-white font-black text-sm uppercase tracking-widest flex items-center gap-2 mb-4 border-l-2 border-red-500 pl-3">
                  3. Localização Base
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-black/40 p-5 rounded-2xl border border-white/5">
                  <div className="md:col-span-3">
                    <label className="text-zinc-500 text-[10px] font-black uppercase tracking-widest block mb-1.5 ml-1">CEP</label>
                    <input value={perfilData.cep} onChange={(e) => setPerfilData({...perfilData, cep: e.target.value})} className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-red-500 text-white text-sm" placeholder="00000-000" />
                  </div>
                  <div className="md:col-span-9">
                    <label className="text-zinc-500 text-[10px] font-black uppercase tracking-widest block mb-1.5 ml-1">Endereço Completo</label>
                    <input value={perfilData.endereco} onChange={(e) => setPerfilData({...perfilData, endereco: e.target.value})} className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-red-500 text-white text-sm" placeholder="Rua, Número, Bairro" />
                  </div>
                  <div className="md:col-span-8">
                    <label className="text-zinc-500 text-[10px] font-black uppercase tracking-widest block mb-1.5 ml-1">Cidade</label>
                    <input value={perfilData.cidade} onChange={(e) => setPerfilData({...perfilData, cidade: e.target.value})} className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-red-500 text-white text-sm" placeholder="Sua Cidade" />
                  </div>
                  <div className="md:col-span-4">
                    <label className="text-zinc-500 text-[10px] font-black uppercase tracking-widest block mb-1.5 ml-1">Estado (UF)</label>
                    <input value={perfilData.estado} onChange={(e) => setPerfilData({...perfilData, estado: e.target.value})} className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-red-500 text-white text-sm" placeholder="Ex: SP" />
                  </div>
                </div>
              </div>

              {/* BOTÃO SALVAR */}
              <div className="pt-6 border-t border-white/5 sticky bottom-0 bg-[#0e0e12]/95 backdrop-blur-md pb-2 mt-8">
                <button type="submit" disabled={savingPerfil} className="cursor-pointer w-full bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-black uppercase tracking-widest py-4 rounded-xl transition-all flex items-center justify-center gap-2 text-xs md:text-sm active:scale-95 shadow-lg">
                  {savingPerfil ? (
                    <><svg className="w-5 h-5 animate-spin text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Guardando no Cofre...</>
                  ) : forceCompletion ? (
                    <><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a2 2 0 11-4 0 2 2 0 014 0zM15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg> Concluir e Acessar Painel</>
                  ) : (
                    "Salvar Atualizações"
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </main>
  );
}