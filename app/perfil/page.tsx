"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import imageCompression from 'browser-image-compression';

export default function PerfilPage() {
  const [fotoUrl, setFotoUrl] = useState("");
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");

  // CONTROLE DE ABAS: 'resumo', 'editar', 'inscricoes'
  const [abaAtiva, setAbaAtiva] = useState("resumo");
  const [filtroInscricao, setFiltroInscricao] = useState("Todas");

  // ESTADOS DO PERFIL
  const [userId, setUserId] = useState("");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [nascimento, setNascimento] = useState("");
  const [telefone, setTelefone] = useState("");
  const [equipe, setEquipe] = useState("");
  const [professor, setProfessor] = useState("");
  const [peso, setPeso] = useState("");
  const [cidade, setCidade] = useState("");
  const [faixa, setFaixa] = useState("");
  const [modalidade, setModalidade] = useState("");

  // ESTADOS DE ESTATÍSTICAS E INSCRIÇÕES
  const [stats, setStats] = useState({ eventos: 0, ouros: 0, pratas: 0, bronzes: 0, wo: 0 });
  const [minhasInscricoes, setMinhasInscricoes] = useState<any[]>([]);

  // FUNÇÕES AUXILIARES
  const formatarCpf = (value: string) => {
    if (!value) return "";
    return value.replace(/\D/g, "").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2").substring(0, 14);
  };

  const calcularIdade = (dataNasc: string) => {
    if (!dataNasc) return "?";
    try {
      const hoje = new Date();
      const nasc = new Date(dataNasc);
      let idade = hoje.getFullYear() - nasc.getFullYear();
      const m = hoje.getMonth() - nasc.getMonth();
      if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
      return Number.isNaN(idade) ? "?" : idade;
    } catch {
      return "?";
    }
  };

  const getCorFaixa = (nomeFaixa: string) => {
    if (!nomeFaixa) return "bg-zinc-800 text-zinc-400 border border-zinc-700";
    const f = nomeFaixa.toLowerCase();
    if (f.includes("branca")) return "bg-white text-black shadow-[0_0_10px_rgba(255,255,255,0.2)]";
    if (f.includes("azul")) return "bg-blue-600 text-white shadow-[0_0_10px_rgba(37,99,235,0.4)]";
    if (f.includes("roxa")) return "bg-purple-600 text-white shadow-[0_0_10px_rgba(147,51,234,0.4)]";
    if (f.includes("marrom")) return "bg-amber-800 text-white shadow-[0_0_10px_rgba(146,64,14,0.4)]";
    if (f.includes("preta")) return "bg-black text-white border border-zinc-700 shadow-[0_0_10px_rgba(0,0,0,0.6)]";
    return "bg-zinc-800 text-zinc-300 border border-zinc-700";
  };

  useEffect(() => {
    async function carregarDadosCompletos() {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        window.location.href = "/login";
        return;
      }

      setUserId(authData.user.id);
      setEmail(authData.user.email || "");

      // 1. PRIMEIRO BUSCAMOS AS INSCRIÇÕES (Para calcular os eventos únicos)
      const { data: inscricoesData } = await supabase
        .from("inscricoes")
        .select(`id, evento_id, categoria, pagamento_ok, eventos (nome, data_evento)`)
        .eq("user_id", authData.user.id);

      if (inscricoesData) setMinhasInscricoes(inscricoesData);

      // 2. LÓGICA DE EVENTOS: Conta quantos eventos ÚNICOS o atleta pagou
      let totalEventosParticipados = 0;
      if (inscricoesData) {
        const inscricoesPagas = inscricoesData.filter(i => i.pagamento_ok);
        const eventosUnicos = new Set(inscricoesPagas.map(i => i.evento_id));
        totalEventosParticipados = eventosUnicos.size;
      }

      // 3. DEPOIS BUSCAMOS O PERFIL
      const { data: perfilData } = await supabase.from("atletas").select("*").eq("user_id", authData.user.id).single();

      if (perfilData) {
        setNome(perfilData.nome || "");
        setFotoUrl(perfilData.foto_url || "");
        setCpf(perfilData.cpf || authData.user.user_metadata?.cpf || "");
        setNascimento(perfilData.nascimento || "");
        setTelefone(perfilData.telefone || "");
        setEquipe(perfilData.equipe || "");
        setProfessor(perfilData.professor || "");
        setPeso(perfilData.peso || "");
        setCidade(perfilData.cidade || "");
        setFaixa(perfilData.faixa || "");
        setModalidade(perfilData.modalidade || "");

        // 4. ATUALIZAMOS OS STATS
        setStats({
          eventos: totalEventosParticipados,
          ouros: perfilData.ouro || 0,
          pratas: perfilData.prata || 0,
          bronzes: perfilData.bronze || 0,
          wo: perfilData.vitorias_wo || 0,
        });

        // 🚨 MÁGICA DO PRIMEIRO ACESSO AQUI:
        // Se o atleta não tem Nome OU não tem CPF, redireciona ele à força para a aba de edição
        if (!perfilData.nome || (!perfilData.cpf && !authData.user.user_metadata?.cpf)) {
          setAbaAtiva("editar");
        }
      } else {
        // Se a linha dele nem existir ainda no banco, manda pra edição!
        setAbaAtiva("editar");
      }

      setLoading(false);
    }
    
    carregarDadosCompletos();
  }, []);

  async function salvarPerfil() {
    setSalvando(true);
    setMensagem("");
    setErro("");

    if (!nome || !cpf) {
      setErro("Nome e CPF são obrigatórios.");
      setSalvando(false);
      return;
    }

    const perfilAtualizado = { user_id: userId, email, nome, cpf, nascimento, telefone, equipe, professor, peso, cidade, faixa, modalidade };
    const { error } = await supabase.from("atletas").upsert(perfilAtualizado, { onConflict: "user_id" });

    if (error) {
      setErro("Erro ao salvar: " + error.message);
    } else {
      setMensagem("Cadastro atualizado com sucesso!");
      setTimeout(() => {
        setMensagem("");
        setAbaAtiva("resumo"); 
      }, 2000);
    }
    setSalvando(false);
  }

  async function sairConta() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  async function handleUploadFoto(event: React.ChangeEvent<HTMLInputElement>) {
    try {
      if (!event.target.files || event.target.files.length === 0) return;

      let file = event.target.files[0];
      setUploadingFoto(true);

      const isHeic = file.type === "image/heic" || file.type === "image/heif" || file.name.toLowerCase().endsWith(".heic");
      
      if (isHeic) {
        try {
          const heic2any = (await import("heic2any")).default;
          const convertedBlob = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.8 });
          const finalBlob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
          file = new File([finalBlob], file.name.replace(/\.[^/.]+$/, ".jpg"), { type: "image/jpeg" });
        } catch (err) {
          alert("Não foi possível processar a foto do seu iPhone. Tente enviar uma foto JPG normal.");
          setUploadingFoto(false);
          event.target.value = "";
          return;
        }
      }

      const formatosValidos = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
      if (!formatosValidos.includes(file.type)) {
        alert("Formato não suportado! Escolha uma foto em JPG ou PNG.");
        setUploadingFoto(false);
        event.target.value = "";
        return;
      }

      const maxSizeBase = 10 * 1024 * 1024; 
      if (file.size > maxSizeBase) {
        alert("Esta foto é gigante demais e pode travar seu dispositivo. Escolha uma foto um pouco mais leve.");
        setUploadingFoto(false);
        event.target.value = "";
        return;
      }

      const options = { maxSizeMB: 1, maxWidthOrHeight: 800, useWebWorker: true };

      try {
        file = await imageCompression(file, options);
      } catch (error) {
        console.warn("Aviso: Não foi possível comprimir a imagem extra.", error);
      }

      const fileExt = file.name.split('.').pop() || 'jpeg';
      const fileName = `${userId}-${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const fotoPublicUrl = publicUrlData.publicUrl;

      const { error: updateError } = await supabase.from('atletas').update({ foto_url: fotoPublicUrl }).eq('user_id', userId);
      if (updateError) throw updateError;

      setFotoUrl(fotoPublicUrl);
      
    } catch (error: any) {
      alert("Erro ao enviar a foto. Tente novamente.");
    } finally {
      setUploadingFoto(false);
    }
  }

  const inscricoesFiltradas = minhasInscricoes.filter((insc) => {
    if (filtroInscricao === "Todas") return true;
    return (insc.pagamento_ok ? "PAGAS" : "PENDENTES") === filtroInscricao.toUpperCase();
  });

  const formatarData = (dataStr: string) => {
    if (!dataStr) return "Data a definir";
    const [ano, mes, dia] = dataStr.split("-");
    return `${dia}/${mes}/${ano}`;
  };

  if (loading) return <div className="p-10 text-center text-zinc-500 mt-20">A carregar perfil...</div>;

  return (
    <div className="px-4 md:px-6 pt-6 md:pt-10 pb-8">
      <div className="grid md:grid-cols-[240px_1fr] gap-4 md:gap-6 max-w-6xl mx-auto">
        
        {/* ========================================== */}
        {/* SIDEBAR ESQUERDA COMPACTA                  */}
        {/* ========================================== */}
        <div className="bg-[#0a0a0e] border border-white/5 rounded-3xl p-5 flex flex-col items-center shadow-xl h-fit relative md:sticky md:top-24 z-10">
          
          <div className="relative mb-4 group cursor-pointer flex-shrink-0" onClick={() => document.getElementById('upload-foto')?.click()}>
            <div className="w-24 h-24 bg-zinc-800 rounded-full flex items-center justify-center text-4xl font-black text-zinc-400 shadow-inner border-[3px] border-[#0a0a0e] ring-2 ring-zinc-700/50 transition-all duration-300 group-hover:ring-cyan-500/50 overflow-hidden relative">
              {uploadingFoto ? (
                <span className="text-[9px] text-cyan-400 font-bold uppercase tracking-widest animate-pulse">Enviando</span>
              ) : fotoUrl ? (
                <img src={fotoUrl} alt="Foto de Perfil" className="w-full h-full object-cover" />
              ) : (
                nome ? nome.charAt(0).toUpperCase() : "?"
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-[9px] text-white font-bold uppercase tracking-widest">Trocar</span>
              </div>
            </div>

            <div className="absolute bottom-0 right-0 bg-cyan-600 text-white p-2 rounded-full shadow-lg border-2 border-[#0a0a0e] transition-transform duration-300 group-hover:scale-110">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path>
              </svg>
            </div>
            <input type="file" accept="image/*" className="hidden" id="upload-foto" onChange={handleUploadFoto} disabled={uploadingFoto} />
          </div>
          
          <h2 className="text-base font-bold text-white text-center leading-tight mb-1">{nome || "Novo Atleta"}</h2>
          <span className="text-cyan-500 text-[9px] font-black uppercase tracking-wider mb-6 text-center">{equipe || "Sem Equipe"}</span>

          <div className="w-full flex flex-col gap-1.5">
            <button onClick={() => setAbaAtiva("resumo")} className={`w-full py-2.5 px-4 rounded-xl text-[11px] font-bold text-left transition-colors flex items-center gap-3 ${abaAtiva === "resumo" ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-sm" : "text-zinc-500 hover:text-white hover:bg-white/5"}`}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
              Meu Perfil
            </button>

            <button onClick={() => setAbaAtiva("editar")} className={`w-full py-2.5 px-4 rounded-xl text-[11px] font-bold text-left transition-colors flex items-center gap-3 ${abaAtiva === "editar" ? "bg-white/10 text-white border border-white/5 shadow-sm" : "text-zinc-500 hover:text-white hover:bg-white/5"}`}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
              Alterar Cadastro
            </button>

            <button onClick={() => setAbaAtiva("inscricoes")} className={`w-full py-2.5 px-4 rounded-xl text-[11px] font-bold text-left transition-colors flex justify-between items-center ${abaAtiva === "inscricoes" ? "bg-white/10 text-white border border-white/5 shadow-sm" : "text-zinc-500 hover:text-white hover:bg-white/5"}`}>
              <span className="flex items-center gap-3"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg> Minhas Inscrições</span>
              {minhasInscricoes.length > 0 && <span className="bg-red-600 text-white text-[9px] px-1.5 py-0.5 rounded-full">{minhasInscricoes.length}</span>}
            </button>

            <button onClick={() => window.location.href = "/"} className="text-zinc-500 hover:text-white hover:bg-white/5 py-2.5 px-4 rounded-xl text-[11px] font-medium text-left transition-colors mb-4 flex items-center gap-3">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
              Ver Eventos
            </button>
          </div>

          <button onClick={sairConta} className="mt-auto w-full border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white py-2.5 rounded-xl font-bold transition-all text-[11px]">Sair da Conta</button>
        </div>

        {/* ========================================== */}
        {/* CONTEÚDO PRINCIPAL COMPACTO                */}
        {/* ========================================== */}
        <div className="bg-[#0a0a0e] border border-white/5 rounded-3xl p-5 md:p-6 shadow-xl min-h-[500px]">
          
          {/* 🟢 ABA 1: MEU PERFIL */}
          {abaAtiva === "resumo" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h3 className="text-lg font-black text-white mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
                Resumo da Carreira
              </h3>
              
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 mb-6">
                <div className="bg-black/50 border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center transition-all duration-300 hover:bg-white/10 hover:-translate-y-1 cursor-default">
                  <span className="text-2xl font-black text-white">{stats.eventos}</span>
                  <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Eventos</span>
                </div>
                
                <div className="bg-[#fff9e6]/5 border border-yellow-500/30 rounded-2xl p-4 flex flex-col items-center justify-center relative overflow-hidden transition-all duration-300 hover:bg-yellow-500/10 hover:-translate-y-1 cursor-default group">
                  <span className="text-2xl font-black text-yellow-500">{stats.ouros}</span>
                  <span className="text-[9px] font-bold text-yellow-600 uppercase tracking-widest mt-1">Ouros</span>
                  <span className="absolute -right-2 -bottom-3 text-5xl opacity-10 transition-transform duration-300 group-hover:scale-110">🥇</span>
                </div>
                
                <div className="bg-[#f4f4f5]/5 border border-zinc-400/30 rounded-2xl p-4 flex flex-col items-center justify-center relative overflow-hidden transition-all duration-300 hover:bg-zinc-400/10 hover:-translate-y-1 cursor-default group">
                  <span className="text-2xl font-black text-zinc-300">{stats.pratas}</span>
                  <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Pratas</span>
                  <span className="absolute -right-2 -bottom-3 text-5xl opacity-10 transition-transform duration-300 group-hover:scale-110">🥈</span>
                </div>
                
                <div className="bg-[#fff1f2]/5 border border-orange-700/40 rounded-2xl p-4 flex flex-col items-center justify-center relative overflow-hidden transition-all duration-300 hover:bg-orange-700/10 hover:-translate-y-1 cursor-default group">
                  <span className="text-2xl font-black text-orange-500">{stats.bronzes}</span>
                  <span className="text-[9px] font-bold text-orange-700 uppercase tracking-widest mt-1">Bronzes</span>
                  <span className="absolute -right-2 -bottom-3 text-5xl opacity-10 transition-transform duration-300 group-hover:scale-110">🥉</span>
                </div>
                
                <div className="col-span-2 md:col-span-1 bg-cyan-900/10 border border-cyan-500/30 rounded-2xl p-4 flex flex-col items-center justify-center relative overflow-hidden transition-all duration-300 hover:bg-cyan-500/10 hover:-translate-y-1 cursor-default group">
                  <span className="text-2xl font-black text-cyan-400">{stats.wo}</span>
                  <span className="text-[9px] font-bold text-cyan-600 uppercase tracking-widest mt-1">Vitórias W.O.</span>
                  <span className="absolute -right-2 -bottom-3 text-5xl opacity-10 transition-transform duration-300 group-hover:scale-110">🥋</span>
                </div>
              </div>

              <div className="h-[1px] w-full bg-white/5 my-6"></div>

              <h3 className="text-lg font-black text-white mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-cyan-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2"></path></svg>
                Ficha Cadastral
              </h3>
              
              <div className="bg-[#0b1320] border border-cyan-500/20 rounded-2xl p-4 md:p-5 shadow-xl transition-all duration-500 hover:border-cyan-500/40">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-black/50 border border-white/5 rounded-xl p-3 md:col-span-2">
                    <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest block mb-0.5">Nome do Atleta</span>
                    <span className="text-base md:text-lg text-white font-black uppercase tracking-tight">{nome || "NÃO CADASTRADO"}</span>
                  </div>
                  <div className="bg-black/50 border border-cyan-500/10 rounded-xl p-3">
                    <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest block mb-0.5">Equipe Oficial</span>
                    <span className="text-sm md:text-base text-cyan-400 font-black uppercase tracking-tight">{equipe || "SEM EQUIPE"}</span>
                  </div>
                  <div className="bg-black/50 border border-white/5 rounded-xl p-3">
                    <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest block mb-0.5">Professor Responsável</span>
                    <span className="text-sm md:text-base text-white font-black uppercase tracking-tight">{professor || "NÃO INFORMADO"}</span>
                  </div>
                  <div className="bg-black/50 border border-white/5 rounded-xl p-3 flex gap-6">
                    <div>
                      <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest block mb-0.5">Idade</span>
                      <span className="text-sm md:text-base text-white font-black uppercase tracking-tight">{nascimento ? `${calcularIdade(nascimento)} ANOS` : "--"}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest block mb-0.5">Peso Base</span>
                      <span className="text-sm md:text-base text-white font-black uppercase tracking-tight">{peso ? `${peso} KG` : "--"}</span>
                    </div>
                  </div>
                  <div className="bg-black/50 border border-white/5 rounded-xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                      <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest block mb-0.5">Modalidade</span>
                      <span className="text-sm md:text-base text-white font-black uppercase tracking-tight">{modalidade || "JIU-JITSU"}</span>
                    </div>
                    <div className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all duration-300 hover:scale-105 cursor-default ${getCorFaixa(faixa)}`}>
                      🥋 {faixa || "NÃO INFORMADA"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 🟠 ABA 2: EDITAR CADASTRO COMPACTA */}
          {abaAtiva === "editar" && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-xl font-black text-white">Alterar Cadastro</h3>
              </div>

              <div className="grid md:grid-cols-2 gap-3 mb-5">
                <div><label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 pl-1">Nome Completo *</label><input type="text" value={nome} onChange={(e) => setNome(e.target.value)} className="w-full bg-black/50 border border-white/5 focus:border-cyan-500/50 outline-none rounded-xl px-3 py-2 text-xs text-white transition-colors" /></div>
                <div><label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 pl-1">E-mail</label><input type="email" value={email} disabled className="w-full bg-black/20 border border-transparent outline-none rounded-xl px-3 py-2 text-xs text-zinc-500 cursor-not-allowed" /></div>
                <div><label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 pl-1">CPF *</label><input type="text" value={cpf} onChange={(e) => setCpf(formatarCpf(e.target.value))} className="w-full bg-black/50 border border-white/5 focus:border-cyan-500/50 outline-none rounded-xl px-3 py-2 text-xs text-white transition-colors" /></div>
                <div><label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 pl-1">Data de Nascimento</label><input type="date" value={nascimento} onChange={(e) => setNascimento(e.target.value)} className="w-full bg-black/50 border border-white/5 focus:border-cyan-500/50 outline-none rounded-xl px-3 py-2 text-xs text-white transition-colors [&::-webkit-calendar-picker-indicator]:invert" /></div>
                <div><label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 pl-1">Telefone / WhatsApp</label><input type="text" value={telefone} onChange={(e) => setTelefone(e.target.value)} className="w-full bg-black/50 border border-white/5 focus:border-cyan-500/50 outline-none rounded-xl px-3 py-2 text-xs text-white transition-colors" /></div>
                <div><label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 pl-1">Equipe</label><input type="text" value={equipe} onChange={(e) => setEquipe(e.target.value)} className="w-full bg-black/50 border border-white/5 focus:border-cyan-500/50 outline-none rounded-xl px-3 py-2 text-xs text-white transition-colors" /></div>
                <div><label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 pl-1">Professor Responsável</label><input type="text" value={professor} onChange={(e) => setProfessor(e.target.value)} className="w-full bg-black/50 border border-white/5 focus:border-cyan-500/50 outline-none rounded-xl px-3 py-2 text-xs text-white transition-colors" /></div>
                <div><label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 pl-1">Faixa</label><select value={faixa} onChange={(e) => setFaixa(e.target.value)} className="w-full bg-black/50 border border-white/5 focus:border-cyan-500/50 outline-none rounded-xl px-3 py-2 text-xs text-white transition-colors appearance-none"><option value="">Selecione...</option><option value="Branca">Branca</option><option value="Azul">Azul</option><option value="Roxa">Roxa</option><option value="Marrom">Marrom</option><option value="Preta">Preta</option></select></div>
                <div><label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 pl-1">Peso (KG)</label><input type="number" step="0.1" value={peso} onChange={(e) => setPeso(e.target.value)} className="w-full bg-black/50 border border-white/5 focus:border-cyan-500/50 outline-none rounded-xl px-3 py-2 text-xs text-white transition-colors" /></div>
                <div><label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 pl-1">Cidade - Estado</label><input type="text" value={cidade} onChange={(e) => setCidade(e.target.value)} className="w-full bg-black/50 border border-white/5 focus:border-cyan-500/50 outline-none rounded-xl px-3 py-2 text-xs text-white transition-colors" /></div>
                <div className="md:col-span-2"><label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 pl-1">Modalidade Principal</label><input type="text" value={modalidade} onChange={(e) => setModalidade(e.target.value)} className="w-full bg-black/50 border border-white/5 focus:border-cyan-500/50 outline-none rounded-xl px-3 py-2 text-xs text-white transition-colors" /></div>
              </div>

              {erro && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg font-medium text-xs">{erro}</div>}
              {mensagem && <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 text-green-400 rounded-lg font-medium text-xs text-center animate-pulse">{mensagem}</div>}

              <button onClick={salvarPerfil} disabled={salvando} className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-black text-sm py-3 rounded-xl transition-all shadow-[0_0_15px_rgba(6,182,212,0.2)] disabled:opacity-50">
                {salvando ? "Salvando..." : "Salvar Alterações"}
              </button>
            </div>
          )}

          {/* 🔵 ABA 3: MINHAS INSCRIÇÕES */}
          {abaAtiva === "inscricoes" && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-3">
                <h3 className="text-xl font-black text-white">Minhas Inscrições</h3>
                <div className="flex bg-black/50 p-1 rounded-xl border border-white/5">
                  {["Todas", "Pagas", "Pendentes"].map((filtro) => (
                    <button key={filtro} onClick={() => setFiltroInscricao(filtro)} className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all uppercase tracking-wider ${filtroInscricao === filtro ? "bg-white/10 text-white shadow-sm" : "text-zinc-500 hover:text-white"}`}>
                      {filtro}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                {inscricoesFiltradas.length === 0 ? (
                  <div className="text-center py-16 bg-black/30 rounded-2xl border border-dashed border-white/10"><p className="text-zinc-500 font-medium text-sm">Nenhuma inscrição encontrada.</p></div>
                ) : (
                  inscricoesFiltradas.map((insc) => (
                    <div key={insc.id} className="bg-black/40 border border-white/5 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:border-white/10 transition-colors">
                      <div>
                        <div className="flex items-center gap-2.5 mb-1.5">
                          <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${insc.pagamento_ok ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-500"}`}>{insc.pagamento_ok ? "PAGO" : "PENDENTE"}</span>
                          <span className="text-zinc-500 text-[10px] font-bold">{insc.eventos?.data_evento ? formatarData(insc.eventos.data_evento) : "Data a definir"}</span>
                        </div>
                        <h4 className="text-base font-black text-white leading-tight">{insc.eventos?.nome || "Campeonato não identificado"}</h4>
                        <p className="text-zinc-400 text-xs mt-0.5">Categoria: <strong className="text-white">{insc.categoria}</strong></p>
                      </div>

                      <div className="w-full md:w-auto flex flex-col gap-1.5">
                        {!insc.pagamento_ok ? (
                          <button className="w-full md:w-auto bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-xl font-bold transition-colors text-xs text-center">Realizar Pagamento</button>
                        ) : (
                          <button onClick={() => window.location.href = `/evento/${insc.evento_id}/chaves`} className="w-full md:w-auto bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl font-bold transition-colors text-xs text-center flex items-center justify-center gap-1.5">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                            Ver Minha Chave
                          </button>
                        )}
                        <button className="w-full md:w-auto text-zinc-500 hover:text-white px-4 py-1.5 rounded-lg font-medium transition-colors text-[10px] uppercase tracking-wider text-center">Detalhes</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}