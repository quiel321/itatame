"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabase";
import { PLANOS_COMERCIAIS, getPlanoComercial, type PlanoComercialId } from "../lib/planos-comerciais";
import Link from "next/link";
import { useRouter } from "next/navigation";
import imageCompression from 'browser-image-compression';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { ShieldCheck, Map, Trash2, Key, Users, CheckCircle, Copy, RefreshCw, Play, Edit3, Trophy, Search, ChevronDown } from "lucide-react";

export default function AdminPage() {
  const router = useRouter();
  
  const [currentUserId, setCurrentUserId] = useState("");
  const [organizadorNome, setOrganizadorNome] = useState("Organizador");
  const [fotoUrl, setFotoUrl] = useState("");
  const [isOrganizadorNativo, setIsOrganizadorNativo] = useState(false);
  const [organizadorFinanceiro, setOrganizadorFinanceiro] = useState<any>(null);
  const [salvandoPlano, setSalvandoPlano] = useState(false);
  
  const [showPerfilModal, setShowPerfilModal] = useState(false);
  const [forceCompletion, setForceCompletion] = useState(false);
  const [savingPerfil, setSavingPerfil] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [perfilData, setPerfilData] = useState({
    nome: "", academia: "", telefone: "", documento: "", cep: "", endereco: "", cidade: "", estado: ""
  });
  const [novaFoto, setNovaFoto] = useState<File | null>(null);
  const [novaFotoPreview, setNovaFotoPreview] = useState("");

  const [eventos, setEventos] = useState<any[]>([]);
  const [eventoSelecionado, setEventoSelecionado] = useState<string>("todos");
  const [inscricoes, setInscricoes] = useState<any[]>([]);
  const [busca, setBusca] = useState("");
  const [filtroPagamento, setFiltroPagamento] = useState("todos");
  const [loading, setLoading] = useState(true);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [editando, setEditando] = useState<any>(null);

  // ==========================================
  // ESTADOS E FUNÇÕES DE GESTÃO DE STAFF
  // ==========================================
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [novoStaff, setNovoStaff] = useState({ funcao: 'mesario', identificacao: '', pin_acesso: '' });

  const abrirModalStaff = async () => {
    if (!eventoSelecionado || eventoSelecionado === "todos") {
      alert("⚠️ Por favor, selecione um campeonato específico no filtro abaixo para gerenciar os PINs da equipe.");
      return;
    }
    setShowStaffModal(true);
    setLoadingStaff(true);
    
    const { data, error } = await supabase
      .from('staff_eventos')
      .select('*')
      .eq('evento_id', eventoSelecionado)
      .order('criado_em', { ascending: false });

    if (!error && data) setStaffList(data);
    setLoadingStaff(false);
  };

  const gerarPinAleatorio = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let pin = '';
    for (let i = 0; i < 6; i++) {
      pin += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNovoStaff({ ...novoStaff, pin_acesso: pin });
  };

  const adicionarStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoStaff.identificacao || !novoStaff.pin_acesso) return;

    setLoadingStaff(true);
    const pinLimpo = novoStaff.pin_acesso.trim().toUpperCase();

    const { data, error } = await supabase.from('staff_eventos').insert([{
      evento_id: eventoSelecionado,
      funcao: novoStaff.funcao,
      identificacao: novoStaff.identificacao,
      pin_acesso: pinLimpo
    }]).select().single();

    if (error) {
      if (error.code === '23505') alert("Este PIN de segurança já está sendo utilizado! Gere outro.");
      else alert("Erro ao criar acesso: " + error.message);
    } else if (data) {
      setStaffList([data, ...staffList]);
      setNovoStaff({ funcao: 'mesario', identificacao: '', pin_acesso: '' });
    }
    setLoadingStaff(false);
  };

  const excluirStaff = async (id: string) => {
    if (!window.confirm("Revogar este acesso? O staff não poderá mais logar com este PIN.")) return;
    await supabase.from('staff_eventos').delete().eq('id', id);
    setStaffList(staffList.filter(s => s.id !== id));
  };


  // ==========================================
  // CARREGAMENTO INICIAL DO USUÁRIO
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

      const { data: orgData } = await supabase.from("organizadores").select("*").eq("user_id", authData.user.id).maybeSingle();

      if (orgData) {
        setIsOrganizadorNativo(true);
        setOrganizadorFinanceiro(orgData);
        setOrganizadorNome(orgData.nome.split(" ")[0]);
        if (orgData.foto_url) setFotoUrl(orgData.foto_url);
        
        setPerfilData({
          nome: orgData.nome || "", academia: orgData.academia || "", telefone: orgData.telefone || "",
          documento: orgData.documento || "", cep: orgData.cep || "", endereco: orgData.endereco || "",
          cidade: orgData.cidade || "", estado: orgData.estado || "",
        });

        if (orgData.perfil_completo === false) {
          setForceCompletion(true);
          setShowPerfilModal(true);
        }

      } else {
        setOrganizadorFinanceiro(null);
        const { data: perfil } = await supabase.from("perfis").select("nome").eq("id", authData.user.id).maybeSingle();
        if (perfil?.nome) setOrganizadorNome(perfil.nome.split(" ")[0]);
        const { data: atleta } = await supabase.from("atletas").select("foto_url").eq("user_id", authData.user.id).maybeSingle();
        if (atleta?.foto_url) setFotoUrl(atleta.foto_url);
      }

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

  useEffect(() => {
    async function carregarInscricoes() {
      if (eventos.length === 0) {
        setInscricoes([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      
      // 🔥 BLINDAGEM DO JOIN: Buscando o nome do evento para não quebrar o layout!
      let query = supabase.from("inscricoes").select("*, eventos(nome)").order("id", { ascending: false });
      
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
    
    if (eventoSelecionado) carregarInscricoes();
  }, [eventoSelecionado, eventos]);

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

      if (novaFoto && currentUserId) {
        const fileExt = novaFoto.name.split('.').pop();
        const fileName = `${currentUserId}-${Date.now()}.${fileExt}`;
        const filePath = `organizadores/${fileName}`;

        const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, novaFoto);
        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
        fotoUrlFinal = publicUrlData.publicUrl;
      }

      const { error: updateError } = await supabase
        .from("organizadores")
        .update({
          nome: perfilData.nome, academia: perfilData.academia, telefone: perfilData.telefone,
          documento: perfilData.documento, cep: perfilData.cep, endereco: perfilData.endereco,
          cidade: perfilData.cidade, estado: perfilData.estado, foto_url: fotoUrlFinal,
          perfil_completo: true 
        })
        .eq("user_id", currentUserId);

      if (updateError) throw updateError;

      setFotoUrl(fotoUrlFinal);
      setOrganizadorNome(perfilData.nome.split(" ")[0]);
      setForceCompletion(false);
      setShowPerfilModal(false);
      alert(forceCompletion ? "Cadastro finalizado com sucesso! Bem-vindo!" : "Perfil atualizado com sucesso!");

    } catch (err) {
      alert("Erro ao salvar o perfil.");
    } finally {
      setSavingPerfil(false);
    }
  }

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

  async function excluirInscricao(id: string, nomeAtleta: string) {
    const confirmacao = window.confirm(`🚨 CUIDADO: Tem certeza que deseja excluir DEFINITIVAMENTE a inscrição de ${nomeAtleta || 'este atleta'}?`);
    if (!confirmacao) return;

    setLoadingId(id);
    try {
      const { error } = await supabase.from("inscricoes").delete().eq("id", id);
      if (error) throw error;
      setInscricoes(prev => prev.filter(inst => inst.id !== id));
      alert("Inscrição excluída com sucesso.");
    } catch (err: any) {
      alert("Erro ao excluir: " + err.message);
    } finally {
      setLoadingId(null);
    }
  }

  // ==========================================
  // FILTRAGEM
  // ==========================================
  const inscricoesFiltradas = inscricoes.filter((inst) => {
    const termo = busca.toLowerCase();
    const matchBusca = (inst.atleta && inst.atleta.toLowerCase().includes(termo)) || (inst.equipe && inst.equipe.toLowerCase().includes(termo));
    const matchPagamento = filtroPagamento === "todos" ? true : filtroPagamento === "pagos" ? inst.pagamento_ok === true : inst.pagamento_ok !== true;
    return matchBusca && matchPagamento;
  });

  // ==========================================
  // MOTOR DE EXPORTAÇÃO (PDF E CSV)
  // ==========================================
  const exportarCSV = () => {
    if (inscricoesFiltradas.length === 0) {
      alert("Nenhuma inscrição encontrada para exportar.");
      return;
    }

    // Cabecalhos do CSV
    const headers = ["Atleta", "Equipe", "Categoria", "Faixa", "Peso", "Status Pagamento", "Peso Check-in", "Campeonato"];
    
    // Converte os dados para as linhas do CSV
    const rows = inscricoesFiltradas.map(insc => [
      `"${insc.atleta || 'N/A'}"`, // Aspas para não quebrar a virgula no excel
      `"${insc.equipe || 'N/A'}"`,
      `"${insc.categoria || 'N/A'}"`,
      `"${insc.faixa || 'N/A'}"`,
      `"${insc.peso ? insc.peso + ' KG' : 'Absoluto'}"`,
      `"${insc.pagamento_ok ? 'PAGO' : 'PENDENTE'}"`,
      `"${insc.pesagem_ok ? 'OK' : 'PENDENTE'}"`,
      `"${insc.eventos?.nome || 'N/A'}"`
    ]);

    // Junta tudo (Cabecalhos + Linhas)
    const csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    
    // Cria o arquivo e força o download
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' }); // \uFEFF força o formato UTF-8 no Excel
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", `inscricoes_iTatame_${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportarPDF = () => {
    if (inscricoesFiltradas.length === 0) {
      alert("Nenhuma inscrição encontrada para exportar.");
      return;
    }

    try {
      // O jsPDF precisa estar instalado: npm install jspdf jspdf-autotable
      const doc = new jsPDF("landscape"); // Landscape porque tem muita coluna

      // Título do PDF
      doc.setFontSize(22);
      doc.setTextColor(220, 38, 38); // Vermelho do iTatame
      doc.text("ITATAME - LISTA DE ATLETAS", 14, 20);

      // Subtítulo descritivo
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100); // Cinza
      const dataHoje = new Date().toLocaleDateString('pt-BR');
      doc.text(`Relatório gerado em ${dataHoje}. Total de atletas: ${inscricoesFiltradas.length}`, 14, 28);

      // Mapeamento dos dados para a tabela do PDF
      const tableColumn = ["Atleta", "Equipe", "Categoria", "Faixa", "Peso", "Financeiro", "Pesagem"];
      
      // 🔥 A CORREÇÃO ESTÁ AQUI: Adicionamos ': any[]' para tipar o array
      const tableRows: any[] = [];

      inscricoesFiltradas.forEach(insc => {
        const inscData = [
          insc.atleta || "N/A",
          insc.equipe || "N/A",
          insc.categoria || "N/A",
          insc.faixa || "N/A",
          insc.peso ? `${insc.peso} KG` : "Abs.",
          insc.pagamento_ok ? "PAGO" : "PENDENTE",
          insc.pesagem_ok ? "OK" : "PEND."
        ];
        tableRows.push(inscData);
      });

      // Gera a tabela usando a extensão autotable
      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 35,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [20, 20, 20], textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [240, 240, 240] },
        columnStyles: {
          0: { cellWidth: 50 }, // Coluna do nome mais larga
          1: { cellWidth: 40 }, // Coluna da equipe
          5: { fontStyle: 'bold', halign: 'center' }, // Coluna Pagamento centralizada
          6: { fontStyle: 'bold', halign: 'center' }  // Coluna Peso centralizada
        }
      });

      // Salva o PDF no computador
      doc.save(`relatorio_iTatame_${new Date().toISOString().slice(0,10)}.pdf`);

    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      alert("Houve um erro ao gerar o PDF. Verifique se as bibliotecas 'jspdf' e 'jspdf-autotable' estão instaladas.");
    }
  };

  const totalInscritos = inscricoes.length;
  const totalPagos = inscricoes.filter(i => i.pagamento_ok).length;
  const totalPendentes = totalInscritos - totalPagos;

  const planoAtual = getPlanoComercial(organizadorFinanceiro?.plano_comercial);
  const mercadoPagoConectado = Boolean(organizadorFinanceiro?.mp_connected_at);

  async function alterarPlanoComercial(planoId: PlanoComercialId) {
    if (!currentUserId || salvandoPlano) return;

    const plano = getPlanoComercial(planoId);
    setSalvandoPlano(true);

    const { error } = await supabase
      .from("organizadores")
      .update({
        plano_comercial: plano.id,
        comissao_percentual: plano.comissaoPercentual,
      })
      .eq("user_id", currentUserId);

    if (error) {
      alert("Não foi possível atualizar o plano. Verifique se o SQL de marketplace já foi aplicado no Supabase.");
    } else {
      setOrganizadorFinanceiro((atual: any) => ({
        ...(atual || {}),
        plano_comercial: plano.id,
        comissao_percentual: plano.comissaoPercentual,
      }));
    }

    setSalvandoPlano(false);
  }
  return (
    <main className="min-h-screen bg-[#050505] text-white p-4 md:p-8 relative overflow-hidden font-sans selection:bg-red-500/30">
      
      {/* EFEITOS DE LUZ SUAVES */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-red-600/5 blur-[150px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-red-900/5 blur-[150px] rounded-full pointer-events-none"></div>

      <div className="max-w-7xl mx-auto relative z-10">
        
        {/* HEADER VIP C/ FOTO */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-white/10">
          <div className="flex items-center gap-4 md:gap-5">
            <div className="shrink-0 relative group">
              {fotoUrl ? (
                <img src={fotoUrl} alt="Perfil Organizador" className="w-16 h-16 md:w-20 md:h-20 rounded-full object-cover border-2 border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.3)]" />
              ) : (
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-zinc-900 border-2 border-white/10 flex items-center justify-center text-zinc-600 shadow-lg">
                  <Users className="w-8 h-8" />
                </div>
              )}
            </div>
            
            <div>
              <span className="text-yellow-500 text-[9px] md:text-[10px] font-black uppercase tracking-widest bg-yellow-500/10 border border-yellow-500/20 px-2.5 py-1 rounded-md mb-2 inline-block shadow-inner">
                Área Exclusiva
              </span>
              <h1 className="text-2xl md:text-4xl font-black text-white tracking-tight">Olá, {organizadorNome}</h1>
              <p className="text-zinc-500 text-[10px] md:text-sm mt-1 font-medium">Seu centro de comando operacional e visão geral.</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 mt-4 md:mt-0 flex-wrap">
            {isOrganizadorNativo && (
              <button onClick={() => setShowPerfilModal(true)} className="cursor-pointer bg-white/5 hover:bg-white/10 border border-white/10 text-white text-[9px] md:text-[10px] font-bold uppercase tracking-widest px-4 py-2.5 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm">
                Editar perfil
              </button>
            )}

            <button onClick={() => supabase.auth.signOut().then(() => router.push('/'))} className="cursor-pointer bg-red-950/30 hover:bg-red-900/50 border border-red-900/50 text-red-500 text-[9px] md:text-[10px] font-bold uppercase tracking-widest px-4 py-2.5 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm">
              Sair do Sistema
            </button>
          </div>
        </div>

        {/* DASHBOARD PRINCIPAL */}
        {!forceCompletion && (
          <div className={showPerfilModal ? "opacity-30 blur-sm pointer-events-none transition-all duration-300" : "transition-all duration-300"}>
            
            {/* AÇÕES RÁPIDAS DINÂMICAS */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4 mb-10">
              
              <Link href="/admin/novo-evento" className="group cursor-pointer bg-black/40 border border-white/5 hover:border-white/20 rounded-2xl p-4 md:p-5 transition-all flex flex-col xl:flex-row xl:items-center gap-3 md:gap-4 shadow-xl hover:-translate-y-1">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-black text-red-500 border border-white/5 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-red-600 group-hover:border-red-500 group-hover:text-white transition-all shadow-inner">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"></path></svg>
                </div>
                <div>
                  <h3 className="text-xs md:text-sm font-black text-white transition-colors leading-tight">Novo Evento</h3>
                  <p className="text-zinc-500 text-[9px] md:text-[10px] font-medium mt-1 hidden md:block">Criar campeonato.</p>
                </div>
              </Link>

              <Link href="/admin/chaves" className="group cursor-pointer bg-black/40 border border-white/5 hover:border-white/20 rounded-2xl p-4 md:p-5 transition-all flex flex-col xl:flex-row xl:items-center gap-3 md:gap-4 shadow-xl hover:-translate-y-1">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-black text-yellow-500 border border-white/5 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-yellow-500 group-hover:border-yellow-500 group-hover:text-black transition-all shadow-inner">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                </div>
                <div>
                  <h3 className="text-xs md:text-sm font-black text-white transition-colors leading-tight">Chaveamento</h3>
                  <p className="text-zinc-500 text-[9px] md:text-[10px] font-medium mt-1 hidden md:block">Sortear atletas.</p>
                </div>
              </Link>

              <Link href="/admin/tatames" className="group cursor-pointer bg-black/40 border border-white/5 hover:border-white/20 rounded-2xl p-4 md:p-5 transition-all flex flex-col xl:flex-row xl:items-center gap-3 md:gap-4 shadow-xl hover:-translate-y-1">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-black text-emerald-500 border border-white/5 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-emerald-500 group-hover:border-emerald-500 group-hover:text-white transition-all shadow-inner">
                  <Map className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs md:text-sm font-black text-white transition-colors leading-tight">Zonas de Luta</h3>
                  <p className="text-zinc-500 text-[9px] md:text-[10px] font-medium mt-1 hidden md:block">Distribuir tatames.</p>
                </div>
              </Link>

              <button onClick={abrirModalStaff} className="text-left group cursor-pointer bg-black/40 border border-white/5 hover:border-white/20 rounded-2xl p-4 md:p-5 transition-all flex flex-col xl:flex-row xl:items-center gap-3 md:gap-4 shadow-xl hover:-translate-y-1">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-black text-blue-400 border border-white/5 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-blue-500 group-hover:border-blue-500 group-hover:text-white transition-all shadow-inner">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs md:text-sm font-black text-white transition-colors leading-tight">Gestão de Equipe</h3>
                  <p className="text-zinc-500 text-[9px] md:text-[10px] font-medium mt-1 hidden md:block">PINs de Segurança.</p>
                </div>
              </button>

              <Link href="/admin/vouchers" className="col-span-2 sm:col-span-1 md:col-span-1 lg:col-span-1 group cursor-pointer bg-black/40 border border-white/5 hover:border-white/20 rounded-2xl p-4 md:p-5 transition-all flex flex-col xl:flex-row xl:items-center gap-3 md:gap-4 shadow-xl hover:-translate-y-1">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-black text-purple-400 border border-white/5 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-purple-500 group-hover:border-purple-500 group-hover:text-white transition-all shadow-inner">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"></path></svg>
                </div>
                <div>
                  <h3 className="text-xs md:text-sm font-black text-white transition-colors leading-tight">Cortesias Livres</h3>
                  <p className="text-zinc-500 text-[9px] md:text-[10px] font-medium mt-1 hidden md:block">Vouchers e Vagas.</p>
                </div>
              </Link>
            </div>


            <section className="bg-black/40 border border-white/5 rounded-2xl p-4 md:p-5 mb-8 shadow-xl">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                <div className="min-w-0">
                  <span className="text-emerald-400 text-[9px] font-black uppercase tracking-widest">Financeiro</span>
                  <h2 className="text-lg md:text-xl font-black text-white mt-1">Plano e Mercado Pago</h2>
                  <p className="text-zinc-500 text-xs mt-1 max-w-2xl">Escolha o bloco contratado pelo organizador e conecte a conta Mercado Pago que receberá as inscrições.</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 lg:items-center">
                  <div className="rounded-xl border border-white/10 bg-[#050505] px-4 py-3 min-w-[170px]">
                    <span className="block text-zinc-500 text-[9px] font-black uppercase tracking-widest">Plano atual</span>
                    <strong className="block text-white text-sm mt-1">{planoAtual.nome} · {planoAtual.comissaoPercentual}%</strong>
                  </div>
                  <Link
                    href={currentUserId ? `/api/mercado-pago/connect?organizador_id=${currentUserId}` : "#"}
                    className={`cursor-pointer text-center rounded-xl px-5 py-3 text-[10px] font-black uppercase tracking-widest border transition-all ${mercadoPagoConectado ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20" : "bg-yellow-500 text-black border-yellow-400 hover:bg-yellow-400"}`}
                  >
                    {mercadoPagoConectado ? "Mercado Pago conectado" : "Conectar Mercado Pago"}
                  </Link>
                  <Link
                    href="/admin/financeiro"
                    className="cursor-pointer text-center rounded-xl px-5 py-3 text-[10px] font-black uppercase tracking-widest border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 transition-all"
                  >
                    Auditoria financeira
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-5">
                {PLANOS_COMERCIAIS.map((plano) => {
                  const ativo = planoAtual.id === plano.id;
                  return (
                    <button
                      key={plano.id}
                      type="button"
                      onClick={() => alterarPlanoComercial(plano.id)}
                      disabled={salvandoPlano || ativo}
                      className={`text-left rounded-xl border p-4 transition-all ${ativo ? "bg-red-600/10 border-red-500/40" : "bg-[#050505] border-white/10 hover:border-white/25"}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-white font-black text-sm uppercase tracking-widest">{plano.nome}</span>
                        <span className={`text-[10px] font-black rounded px-2 py-1 ${ativo ? "bg-red-500 text-white" : "bg-white/5 text-zinc-400"}`}>{plano.comissaoPercentual}%</span>
                      </div>
                      <p className="text-zinc-500 text-xs mt-2 leading-relaxed">{plano.resumo}</p>
                      <div className="flex flex-wrap gap-2 mt-3">
                        {plano.recursos.map((recurso) => (
                          <span key={recurso} className="text-[9px] text-zinc-400 bg-white/5 border border-white/5 rounded px-2 py-1 uppercase tracking-widest">{recurso}</span>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-white/5 pb-4">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-red-500" />
                <h2 className="text-xl font-black uppercase tracking-widest text-white">Gestão de Inscrições</h2>
              </div>
              <div className="flex gap-2 w-full md:w-auto">
                <button onClick={exportarCSV} className="flex-1 md:flex-none justify-center cursor-pointer bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white text-[9px] md:text-[10px] font-bold uppercase tracking-widest px-4 py-2.5 rounded-lg transition-colors flex items-center gap-1.5 active:scale-95 shadow-sm">
                  Gerar CSV
                </button>
                <button onClick={exportarPDF} className="flex-1 md:flex-none justify-center cursor-pointer bg-red-600/10 hover:bg-red-600/20 border border-red-500/30 text-red-500 hover:text-red-400 text-[9px] md:text-[10px] font-bold uppercase tracking-widest px-4 py-2.5 rounded-lg transition-colors flex items-center gap-1.5 active:scale-95 shadow-sm">
                  Gerar PDF
                </button>
              </div>
            </div>

            {/* SELETOR DE EVENTO E BUSCA BLENDADO */}
            <div className="bg-black/40 border border-white/5 rounded-2xl p-3 md:p-4 mb-8 flex flex-col md:flex-row items-center gap-3 shadow-xl">
              <label className="text-zinc-500 font-black uppercase tracking-widest text-[9px] md:text-[10px] shrink-0 pl-2">Filtrar Evento:</label>
              
              <div className="relative w-full md:w-1/3 cursor-pointer">
                <select value={eventoSelecionado} onChange={(e) => setEventoSelecionado(e.target.value)} className="cursor-pointer w-full bg-[#050505] border border-white/10 focus:border-red-500 outline-none rounded-xl px-4 py-3 text-white transition-all appearance-none font-bold text-xs shadow-inner" disabled={eventos.length === 0}>
                  {eventos.length === 0 && <option value="">Nenhum evento criado ainda...</option>}
                  {eventos.length > 0 && <option value="todos">Todos os seus eventos</option>}
                  {eventos.map(ev => <option key={ev.id} value={ev.id.toString()}>🏆 {ev.nome}</option>)}
                </select>
                <ChevronDown className="w-4 h-4 text-zinc-500 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {eventoSelecionado && eventoSelecionado !== "todos" && (
                <Link 
                  href={`/admin/eventos/${eventoSelecionado}/editar`} 
                  className="cursor-pointer w-full md:w-auto shrink-0 bg-red-600/10 hover:bg-red-600/20 border border-red-500/30 text-red-500 hover:text-red-400 text-[10px] font-bold uppercase tracking-widest px-4 py-3 rounded-xl transition-all flex items-center justify-center gap-2 active:scale-95 shadow-sm"
                >
                  <Edit3 size={14} /> Editar Regras e Banner
                </Link>
              )}

              {eventos.length > 0 && (
                <>
                  <div className="flex-1 relative cursor-text w-full">
                    <Search className="w-4 h-4 text-zinc-500 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input type="text" placeholder="Buscar atleta ou academia..." value={busca} onChange={(e) => setBusca(e.target.value)} className="w-full bg-[#050505] border border-white/10 rounded-xl pl-11 pr-4 py-3 outline-none focus:border-red-500 text-white transition-colors text-xs placeholder:text-zinc-600 shadow-inner" />
                  </div>
                  <div className="w-full md:w-48 relative cursor-pointer">
                    <select value={filtroPagamento} onChange={(e) => setFiltroPagamento(e.target.value)} className="cursor-pointer w-full bg-[#050505] border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-red-500 text-zinc-300 transition-colors appearance-none text-xs font-bold shadow-inner">
                      <option value="todos">Todos os Status</option>
                      <option value="pagos">Somente Pagos</option>
                      <option value="pendentes">Somente Pendentes</option>
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-zinc-500 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </>
              )}
            </div>

            {/* NUMEROS SUAVES */}
            {eventos.length > 0 && (
              <div className="grid grid-cols-3 gap-3 md:gap-5 mb-8">
                <div className="bg-black/40 border border-white/5 rounded-2xl p-4 md:p-6 shadow-xl flex flex-col items-center justify-center text-center backdrop-blur-sm">
                  <h3 className="text-zinc-500 font-black uppercase text-[9px] md:text-[11px] tracking-widest mb-1.5">Total Inscritos</h3>
                  <p className="text-2xl md:text-4xl font-black text-white">{totalInscritos}</p>
                </div>
                <div className="bg-green-500/5 border border-green-500/10 rounded-2xl p-4 md:p-6 shadow-xl flex flex-col items-center justify-center text-center backdrop-blur-sm">
                  <h3 className="text-green-500/80 font-black uppercase text-[9px] md:text-[11px] tracking-widest mb-1.5">Pagos Confirmados</h3>
                  <p className="text-2xl md:text-4xl font-black text-green-500 drop-shadow-[0_0_15px_rgba(34,197,94,0.3)]">{totalPagos}</p>
                </div>
                <div className="bg-red-500/5 border border-red-500/10 rounded-2xl p-4 md:p-6 shadow-xl flex flex-col items-center justify-center text-center backdrop-blur-sm">
                  <h3 className="text-red-500/80 font-black uppercase text-[9px] md:text-[11px] tracking-widest mb-1.5">Aguardando Pagamento</h3>
                  <p className="text-2xl md:text-4xl font-black text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.3)]">{totalPendentes}</p>
                </div>
              </div>
            )}

            {!loading && eventos.length === 0 && (
              <div className="py-20 text-center flex flex-col items-center justify-center bg-black/40 border border-dashed border-white/10 rounded-3xl mt-4 shadow-xl">
                <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-4">
                  <Trophy className="w-10 h-10 text-zinc-500" />
                </div>
                <h3 className="text-xl font-black text-white mb-2">Nenhum evento criado.</h3>
                <p className="text-zinc-500 text-xs md:text-sm mb-6 max-w-md">Comece agora clicando no botão abaixo.</p>
                <Link href="/admin/novo-evento" className="cursor-pointer bg-red-600 hover:bg-red-500 text-white text-xs font-black uppercase tracking-widest px-8 py-4 rounded-xl shadow-[0_0_20px_rgba(239,68,68,0.3)] transition-all active:scale-95">
                  Criar Meu Primeiro Evento
                </Link>
              </div>
            )}

            {/* ========================================================= */}
            {/* GRID DE ATLETAS (CLEAN DESIGN - SEM MEXER NO PESO)          */}
            {/* ========================================================= */}
            {eventos.length > 0 && !loading && (
              inscricoesFiltradas.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5">
                  {inscricoesFiltradas.map((insc) => (
                    <div key={insc.id} className="bg-[#0a0a0e] border border-white/5 rounded-[20px] p-5 flex flex-col justify-between hover:border-white/10 transition-all shadow-xl h-full relative overflow-hidden group">
                      
                      {/* BARRA SUPERIOR SUAVE */}
                      <div className={`absolute top-0 left-0 w-full h-1 ${insc.pagamento_ok ? 'bg-green-500/80 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-red-500/80 shadow-[0_0_10px_rgba(239,68,68,0.5)]'}`}></div>

                      <div className="relative z-10 flex-1">
                        
                        <div className="flex items-start justify-between gap-2 mb-4 mt-1">
                          <span className="text-zinc-500 text-[9px] font-bold uppercase tracking-widest truncate max-w-[120px]" title={insc.eventos?.nome}>
                            {insc.eventos?.nome || "Evento"}
                          </span>
                          
                          <div className="flex gap-1.5 items-center shrink-0">
                            <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${insc.pagamento_ok ? "bg-green-500/10 text-green-500 border-green-500/20" : "bg-red-500/10 text-red-500 border-red-500/20"}`}>
                              {insc.pagamento_ok ? '$$ Pago' : 'Pendente'}
                            </span>
                            
                            {/* PESO AGORA É APENAS VISUAL (NÃO CLICÁVEL) */}
                            <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${insc.pesagem_ok ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : "bg-zinc-800 text-zinc-400 border-white/5"}`}>
                              {insc.pesagem_ok ? 'Peso OK' : 'S/ Peso'}
                            </span>
                          </div>
                        </div>

                        <h4 className="text-lg md:text-xl font-black text-white uppercase tracking-tight line-clamp-1" title={insc.atleta}>{insc.atleta || "NÃO INFORMADO"}</h4>
                        <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mt-0.5 line-clamp-1" title={insc.equipe}>{insc.equipe || "SEM EQUIPE"}</p>
                        
                        <div className="flex flex-col gap-2 mt-4 mb-6">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-zinc-300 bg-black px-2.5 py-1.5 rounded-md border border-white/5 flex items-center gap-1"><span className="text-zinc-500">Faixa:</span> {insc.faixa || "?"}</span>
                            <span className="text-[10px] font-bold text-zinc-300 bg-black px-2.5 py-1.5 rounded-md border border-white/5 flex items-center gap-1"><span className="text-zinc-500">Peso:</span> {insc.peso ? `${insc.peso} KG` : "Abs."}</span>
                          </div>
                          <span className="text-[10px] font-bold text-yellow-500/90 bg-yellow-500/5 border border-yellow-500/10 px-2.5 py-1.5 rounded-md truncate w-full flex items-center gap-1.5" title={insc.categoria}>
                            <Trophy size={12} /> {insc.categoria}
                          </span>
                        </div>
                      </div>

                      {/* RODAPÉ DE AÇÕES DISCRETO */}
                      <div className="relative z-10 flex flex-col gap-2 mt-auto border-t border-white/5 pt-4">
                        
                        {/* PAGAMENTO (VERDE SE PENDENTE, DISCRETO SE OK) */}
                        <button 
                          onClick={() => toggleStatus(insc.id, 'pagamento_ok', insc.pagamento_ok)}
                          disabled={loadingId === insc.id}
                          className={`cursor-pointer w-full py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border flex items-center justify-center active:scale-95 ${insc.pagamento_ok ? 'bg-transparent text-zinc-500 border-white/5 hover:text-white hover:bg-white/5' : 'bg-green-600/10 text-green-500 border-green-500/30 hover:bg-green-600/20'}`}
                        >
                          {loadingId === insc.id ? '...' : insc.pagamento_ok ? 'Desfazer Pagamento' : 'Aprovar Pagamento'}
                        </button>
                        
                        <div className="flex gap-2">
                          <button 
                            onClick={() => setEditando(insc)} 
                            className="cursor-pointer flex-1 py-2 rounded-lg text-[9px] font-bold text-zinc-400 hover:text-white hover:bg-white/5 transition-colors uppercase tracking-widest active:scale-95 flex items-center justify-center gap-1.5 bg-transparent border border-transparent hover:border-white/10"
                          >
                            <Edit3 size={12} /> Editar
                          </button>
                          <button 
                            onClick={() => excluirInscricao(insc.id, insc.atleta || 'Atleta')} 
                            disabled={loadingId === insc.id} 
                            className="cursor-pointer flex-1 py-2 rounded-lg text-[9px] font-bold text-red-500/70 hover:text-red-500 hover:bg-red-500/10 transition-colors uppercase tracking-widest active:scale-95 flex items-center justify-center gap-1.5 bg-transparent border border-transparent hover:border-red-500/20 disabled:opacity-50"
                          >
                            <Trash2 size={12} /> Excluir
                          </button>
                        </div>
                      </div>

                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 bg-black/40 border border-white/5 rounded-2xl shadow-xl">
                  <p className="text-zinc-500 text-sm font-medium">Nenhum atleta encontrado com os filtros atuais.</p>
                </div>
              )
            )}

          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* MODAL MESTRE DE GESTÃO DE STAFF E PINs                     */}
      {/* ========================================================= */}
      {showStaffModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in zoom-in duration-300">
          <div className="bg-[#0e0e12] border border-white/10 rounded-3xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            
            <div className="p-6 border-b border-white/5 flex justify-between items-center bg-black/50">
              <div>
                <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight text-white flex items-center gap-2">
                  <ShieldCheck className="text-red-500 w-6 h-6"/> Central Operacional
                </h2>
                <p className="text-zinc-400 text-xs mt-1">Crie as chaves de acesso (PINs) para a equipe deste evento.</p>
              </div>
              <button onClick={() => setShowStaffModal(false)} className="p-2 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white rounded-xl transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
              
              <form onSubmit={adicionarStaff} className="bg-black/40 p-4 md:p-5 rounded-2xl border border-white/5 flex flex-col md:flex-row gap-4 items-end mb-8 shadow-inner">
                <div className="w-full md:w-1/4">
                  <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1.5 block pl-1">Acesso (Função)</label>
                  <select required value={novoStaff.funcao} onChange={(e) => setNovoStaff({...novoStaff, funcao: e.target.value})} className="w-full bg-[#050505] border border-white/10 rounded-xl px-4 py-3 outline-none text-white text-xs font-bold appearance-none cursor-pointer">
                    <option value="mesario">Mesário / Tatame</option>
                    <option value="checkin">Recepção / Check-in</option>
                  </select>
                </div>

                <div className="w-full md:w-1/3">
                  <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1.5 block pl-1">Identificação na Tela</label>
                  <input required type="text" placeholder="Ex: Tatame 1" value={novoStaff.identificacao} onChange={(e) => setNovoStaff({...novoStaff, identificacao: e.target.value})} className="w-full bg-[#050505] border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-red-500 text-white text-xs font-bold placeholder:text-zinc-700" />
                </div>

                <div className="w-full md:w-1/3">
                  <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1.5 block pl-1">PIN Secreto</label>
                  <div className="flex gap-2">
                    <input required type="text" placeholder="TAT001" value={novoStaff.pin_acesso} onChange={(e) => setNovoStaff({...novoStaff, pin_acesso: e.target.value.toUpperCase()})} className="w-full bg-[#050505] border border-white/10 rounded-xl px-3 py-3 outline-none focus:border-red-500 text-white text-xs font-black uppercase tracking-widest placeholder:text-zinc-700" />
                    <button type="button" onClick={gerarPinAleatorio} title="Gerar PIN Seguro" className="bg-white/5 hover:bg-white/10 text-zinc-400 px-3 rounded-xl border border-white/5 transition-colors cursor-pointer">
                      <RefreshCw size={14} />
                    </button>
                  </div>
                </div>

                <button type="submit" disabled={loadingStaff} className="cursor-pointer w-full md:w-auto shrink-0 bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-widest px-6 py-3 rounded-xl transition-all shadow-lg text-[10px] md:text-xs">
                  Criar Acesso
                </button>
              </form>

              <h3 className="text-white font-black text-sm uppercase tracking-widest mb-4 border-l-2 border-red-500 pl-3">Credenciais Ativas</h3>
              
              {loadingStaff ? (
                <div className="text-center py-10"><RefreshCw className="animate-spin text-zinc-500 mx-auto" /></div>
              ) : staffList.length === 0 ? (
                <div className="text-center py-10 bg-black/20 rounded-2xl border border-dashed border-white/5 text-zinc-500 text-xs font-bold uppercase tracking-widest">Nenhuma equipe cadastrada para este evento.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {staffList.map(staff => (
                    <div key={staff.id} className="bg-black/60 border border-white/5 p-4 rounded-2xl flex items-center justify-between gap-2 group hover:border-white/20 transition-all">
                      
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-inner ${staff.funcao === 'checkin' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-blue-500/10 text-blue-500 border border-blue-500/20'}`}>
                          {staff.funcao === 'checkin' ? <Users size={18} /> : <Play size={18} fill="currentColor" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-white font-black text-sm uppercase tracking-tight truncate w-full">{staff.identificacao}</h4>
                          <span className="text-zinc-500 text-[9px] font-bold uppercase tracking-widest block truncate">{staff.funcao}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="bg-[#050505] border border-zinc-800 px-2.5 py-1.5 rounded-lg text-yellow-500 font-mono text-xs font-black tracking-widest flex items-center gap-1.5 cursor-pointer hover:bg-white/5 transition-colors" title="Copiar PIN" onClick={() => {navigator.clipboard.writeText(staff.pin_acesso); alert('PIN Copiado!')}}>
                          <Key size={12} className="text-zinc-600" /> {staff.pin_acesso}
                        </div>
                        <button onClick={() => excluirStaff(staff.id)} className="cursor-pointer text-zinc-600 hover:text-red-500 transition-colors p-2 bg-white/5 hover:bg-red-500/10 rounded-lg">
                          <Trash2 size={16} />
                        </button>
                      </div>

                    </div>
                  ))}
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* MODAL DE EDIÇÃO RÁPIDA */}
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

      {/* ========================================================================= */}
      {/* MODAL DE PERFIL COMPACTADO (NOVO VISUAL)                                  */}
      {/* ========================================================================= */}
      {showPerfilModal && (
        <div className={`fixed inset-0 z-[200] flex items-center justify-center p-3 md:p-6 bg-black/95 backdrop-blur-md animate-in fade-in zoom-in duration-300 ${forceCompletion ? 'pointer-events-auto' : ''}`}>
          <div className="bg-[#0e0e12] border border-white/10 rounded-2xl md:rounded-3xl w-full max-w-4xl shadow-2xl relative overflow-hidden flex flex-col max-h-[95vh] md:max-h-[90vh]">
            
            {/* HEADER MAIS ENXUTO */}
            <div className="p-4 md:p-6 border-b border-white/5 relative z-10 shrink-0 bg-black/50">
              {forceCompletion && (
                <span className="inline-block bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 text-[9px] md:text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-md mb-2 animate-pulse">
                  Ação Obrigatória
                </span>
              )}
              <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight">
                {forceCompletion ? "Finalize o Seu Cadastro" : "Configurações do Perfil"}
              </h2>
              <p className="text-zinc-500 text-[10px] md:text-xs mt-1">
                {forceCompletion ? "Preencha os dados abaixo para liberar o acesso total ao painel." : "Mantenha as informações da sua organização atualizadas."}
              </p>
              {!forceCompletion && (
                <button onClick={() => setShowPerfilModal(false)} className="absolute top-4 right-4 p-2 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white rounded-lg transition-colors cursor-pointer">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
              )}
            </div>

            {/* FORMULÁRIO COM ESPAÇAMENTOS E INPUTS REDUZIDOS */}
            <form onSubmit={salvarPerfil} className="p-4 md:p-6 overflow-y-auto flex-1 custom-scrollbar relative z-10 space-y-5">
              
              {/* SESSÃO 1: IDENTIDADE */}
              <div>
                <h3 className="text-white font-black text-xs md:text-sm uppercase tracking-widest flex items-center gap-2 mb-3 border-l-2 border-red-500 pl-3">1. Identidade Visual</h3>
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 bg-black/40 p-4 rounded-xl border border-white/5">
                  <div className="shrink-0 flex flex-col items-center">
                    <div className="relative w-20 h-20 md:w-24 md:h-24 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center bg-black hover:border-red-500/50 transition-colors cursor-pointer group overflow-hidden shadow-xl" onClick={() => fileInputRef.current?.click()}>
                      {novaFotoPreview || fotoUrl ? (
                        <img src={novaFotoPreview || fotoUrl} alt="Preview" className="w-full h-full object-cover rounded-full" />
                      ) : (
                        <svg className="w-8 h-8 text-zinc-600 group-hover:text-red-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      )}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <span className="text-white text-[9px] font-black uppercase tracking-widest text-center px-2">Alterar</span>
                      </div>
                    </div>
                    <input type="file" accept="image/*, .heic" className="hidden" ref={fileInputRef} onChange={handleNovaFoto} />
                  </div>
                  <div className="flex-1 space-y-3 w-full">
                    <div>
                      <label className="text-zinc-500 text-[9px] md:text-[10px] font-black uppercase tracking-widest block mb-1 ml-1">Nome do Gestor Responsável *</label>
                      <input required value={perfilData.nome} onChange={(e) => setPerfilData({...perfilData, nome: e.target.value})} className="w-full bg-black border border-white/10 rounded-lg px-3 py-2.5 outline-none focus:border-red-500 text-white text-xs md:text-sm" placeholder="Ex: Alex Nunes" />
                    </div>
                    <div>
                      <label className="text-zinc-500 text-[9px] md:text-[10px] font-black uppercase tracking-widest block mb-1 ml-1">Nome da Organização / Evento *</label>
                      <input required value={perfilData.academia} onChange={(e) => setPerfilData({...perfilData, academia: e.target.value})} className="w-full bg-black border border-white/10 rounded-lg px-3 py-2.5 outline-none focus:border-red-500 text-white text-xs md:text-sm" placeholder="Ex: Copa iTatame" />
                    </div>
                  </div>
                </div>
              </div>

              {/* SESSÃO 2: DOCUMENTAÇÃO */}
              <div>
                <h3 className="text-white font-black text-xs md:text-sm uppercase tracking-widest flex items-center gap-2 mb-3 border-l-2 border-red-500 pl-3">2. Documentação Oficial</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-black/40 p-4 rounded-xl border border-white/5">
                  <div>
                    <label className="text-zinc-500 text-[9px] md:text-[10px] font-black uppercase tracking-widest block mb-1 ml-1">CPF ou CNPJ (Repasses) *</label>
                    <input required value={perfilData.documento} onChange={(e) => setPerfilData({...perfilData, documento: e.target.value})} className="w-full bg-black border border-white/10 rounded-lg px-3 py-2.5 outline-none focus:border-red-500 text-white text-xs md:text-sm" placeholder="000.000.000-00" />
                  </div>
                  <div>
                    <label className="text-zinc-500 text-[9px] md:text-[10px] font-black uppercase tracking-widest block mb-1 ml-1">WhatsApp de Suporte *</label>
                    <input required value={perfilData.telefone} onChange={(e) => setPerfilData({...perfilData, telefone: e.target.value})} className="w-full bg-black border border-white/10 rounded-lg px-3 py-2.5 outline-none focus:border-red-500 text-white text-xs md:text-sm" placeholder="(00) 00000-0000" />
                  </div>
                </div>
              </div>

              {/* SESSÃO 3: LOCALIZAÇÃO */}
              <div>
                <h3 className="text-white font-black text-xs md:text-sm uppercase tracking-widest flex items-center gap-2 mb-3 border-l-2 border-red-500 pl-3">3. Localização Base</h3>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-black/40 p-4 rounded-xl border border-white/5">
                  <div className="md:col-span-4 lg:col-span-3">
                    <label className="text-zinc-500 text-[9px] md:text-[10px] font-black uppercase tracking-widest block mb-1 ml-1">CEP</label>
                    <input value={perfilData.cep} onChange={(e) => setPerfilData({...perfilData, cep: e.target.value})} className="w-full bg-black border border-white/10 rounded-lg px-3 py-2.5 outline-none focus:border-red-500 text-white text-xs md:text-sm" placeholder="00000-000" />
                  </div>
                  <div className="md:col-span-8 lg:col-span-9">
                    <label className="text-zinc-500 text-[9px] md:text-[10px] font-black uppercase tracking-widest block mb-1 ml-1">Endereço Completo</label>
                    <input value={perfilData.endereco} onChange={(e) => setPerfilData({...perfilData, endereco: e.target.value})} className="w-full bg-black border border-white/10 rounded-lg px-3 py-2.5 outline-none focus:border-red-500 text-white text-xs md:text-sm" placeholder="Rua, Número, Bairro" />
                  </div>
                  <div className="md:col-span-8">
                    <label className="text-zinc-500 text-[9px] md:text-[10px] font-black uppercase tracking-widest block mb-1 ml-1">Cidade</label>
                    <input value={perfilData.cidade} onChange={(e) => setPerfilData({...perfilData, cidade: e.target.value})} className="w-full bg-black border border-white/10 rounded-lg px-3 py-2.5 outline-none focus:border-red-500 text-white text-xs md:text-sm" placeholder="Sua Cidade" />
                  </div>
                  <div className="md:col-span-4">
                    <label className="text-zinc-500 text-[9px] md:text-[10px] font-black uppercase tracking-widest block mb-1 ml-1">Estado (UF)</label>
                    <input value={perfilData.estado} onChange={(e) => setPerfilData({...perfilData, estado: e.target.value})} className="w-full bg-black border border-white/10 rounded-lg px-3 py-2.5 outline-none focus:border-red-500 text-white text-xs md:text-sm" placeholder="Ex: SP" />
                  </div>
                </div>
              </div>

              {/* BOTÃO SUBMIT */}
              <div className="pt-4 border-t border-white/5 sticky bottom-0 bg-[#0e0e12]/95 backdrop-blur-md pb-2 mt-4">
                <button type="submit" disabled={savingPerfil} className="cursor-pointer w-full bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-black uppercase tracking-widest py-3 md:py-3.5 rounded-lg transition-all flex items-center justify-center gap-2 text-[10px] md:text-xs active:scale-95 shadow-lg">
                  {savingPerfil ? (
                    <><svg className="w-4 h-4 animate-spin text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Guardando...</>
                  ) : forceCompletion ? (
                    <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a2 2 0 11-4 0 2 2 0 014 0zM15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg> Concluir e Acessar Painel</>
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
