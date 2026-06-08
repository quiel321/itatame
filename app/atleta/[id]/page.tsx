"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

export default function PerfilPublicoAtleta() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [atleta, setAtleta] = useState<any>(null);
  const [historico, setHistorico] = useState<any[]>([]);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    async function carregarPerfil() {
      if (!userId) return;

      // 1. Busca os dados do Atleta
      const { data: atlData } = await supabase
        .from("atletas")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (atlData) {
        setAtleta(atlData);

        // 2. Busca o histórico de eventos que ele participou (Pagos)
        const { data: inscData } = await supabase
          .from("inscricoes")
          .select(`
            id, 
            categoria, 
            eventos (nome, data_evento, cidade, estado, banner_url)
          `)
          .eq("user_id", userId)
          .eq("pagamento_ok", true)
          .order("created_at", { ascending: false });

        if (inscData) setHistorico(inscData);
      }
      
      setLoading(false);
    }
    
    carregarPerfil();
  }, [userId]);

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

  const getEstiloFaixa = (nomeFaixa: string) => {
    if (!nomeFaixa) return { bg: "bg-zinc-800 text-zinc-400", border: "border-zinc-700", glow: "shadow-[0_0_15px_rgba(255,255,255,0.05)]" };
    const f = nomeFaixa.toLowerCase();
    if (f.includes("branca")) return { bg: "bg-white text-black", border: "border-white", glow: "shadow-[0_0_20px_rgba(255,255,255,0.2)]" };
    if (f.includes("azul")) return { bg: "bg-blue-600 text-white", border: "border-blue-500", glow: "shadow-[0_0_20px_rgba(37,99,235,0.3)]" };
    if (f.includes("roxa")) return { bg: "bg-purple-600 text-white", border: "border-purple-500", glow: "shadow-[0_0_20px_rgba(147,51,234,0.3)]" };
    if (f.includes("marrom")) return { bg: "bg-amber-800 text-white", border: "border-amber-700", glow: "shadow-[0_0_20px_rgba(146,64,14,0.3)]" };
    if (f.includes("preta")) return { bg: "bg-black text-white", border: "border-zinc-700", glow: "shadow-[0_0_20px_rgba(255,255,255,0.15)]" };
    return { bg: "bg-zinc-800 text-zinc-300", border: "border-zinc-700", glow: "shadow-[0_0_15px_rgba(255,255,255,0.05)]" };
  };

  const compartilharPerfil = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  if (loading) return <div className="min-h-screen bg-[#050505] flex items-center justify-center text-cyan-500 font-black text-[10px] uppercase tracking-widest animate-pulse">Buscando Atleta...</div>;

  if (!atleta) return (
    <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-6 text-center">
      <span className="text-4xl mb-3 opacity-30">🥋</span>
      <h2 className="text-lg font-black text-white mb-1">Atleta Não Encontrado</h2>
      <p className="text-zinc-500 text-xs mb-6 max-w-sm">O perfil que você está tentando acessar não existe ou foi removido.</p>
      <button onClick={() => router.push("/")} className="bg-cyan-600 hover:bg-cyan-500 text-white font-black px-6 py-2.5 rounded-lg uppercase tracking-widest text-[10px] transition-colors">Ir para a Home</button>
    </div>
  );

  const estiloFaixa = getEstiloFaixa(atleta.faixa);

  return (
    <main className="min-h-screen bg-[#050505] font-sans relative overflow-x-hidden selection:bg-cyan-500/30 pb-20">
      
      {/* 🌟 EFEITOS DE FUNDO SUTIS */}
      <div className="absolute top-0 left-0 w-full h-[300px] bg-gradient-to-b from-cyan-900/10 to-transparent pointer-events-none"></div>
      <div className="absolute top-[-50px] left-1/2 -translate-x-1/2 w-[400px] h-[200px] bg-cyan-500/5 blur-[80px] rounded-full pointer-events-none"></div>

      {/* CONTAINER "APP FEEL" (max-w-2xl para ficar estreito e focado) */}
      <div className="max-w-2xl mx-auto relative z-10 px-4 sm:px-6 pt-6">
        
        {/* CABEÇALHO / VOLTAR */}
        <div className="flex justify-between items-center mb-6">
          <button onClick={() => router.push("/")} className="text-zinc-500 hover:text-white flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"></path></svg>
            iTatame
          </button>
          
          <button onClick={compartilharPerfil} className={`flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full transition-all border ${copiado ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-white/5 text-zinc-300 border-white/5 hover:bg-white/10 hover:text-white'}`}>
            {copiado ? (
              <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path></svg> Copiado!</>
            ) : (
              <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path></svg> Compartilhar</>
            )}
          </button>
        </div>

        {/* 🏆 CARD PRINCIPAL DO ATLETA */}
        <div className="bg-[#0b1320] border border-cyan-500/10 rounded-2xl p-5 md:p-6 shadow-xl relative overflow-hidden mb-6">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-4 md:gap-6 relative z-10">
            
            {/* FOTO COM GLOW DA FAIXA */}
            <div className={`w-28 h-28 md:w-32 md:h-32 rounded-full shrink-0 relative flex items-center justify-center bg-zinc-900 border-[3px] ${estiloFaixa.border} ${estiloFaixa.glow}`}>
              {atleta.foto_url ? (
                <img src={atleta.foto_url} alt={atleta.nome} className="w-full h-full object-cover rounded-full" />
              ) : (
                <span className="text-4xl font-black text-zinc-700">{atleta.nome?.charAt(0)}</span>
              )}
              {/* Etiqueta da Faixa */}
              <div className={`absolute -bottom-2 px-3 py-1 rounded-md text-[8px] font-black uppercase tracking-widest border border-white/10 shadow-sm ${estiloFaixa.bg}`}>
                {atleta.faixa || "S/ Faixa"}
              </div>
            </div>

            {/* DADOS DO ATLETA */}
            <div className="flex-1 text-center md:text-left w-full mt-2 md:mt-0">
              <div className="inline-block bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded mb-2">
                Atleta Oficial iTatame
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-white leading-tight tracking-tight mb-1">
                {atleta.nome}
              </h1>
              
              <h2 className="text-xs md:text-sm text-zinc-400 font-medium flex flex-col md:flex-row items-center md:items-start gap-1 md:gap-2 mb-4">
                <span className="text-zinc-200 font-bold">{atleta.equipe || "Equipe Não Informada"}</span>
                {atleta.academia && <span className="hidden md:inline text-zinc-600">•</span>}
                {atleta.academia && <span>{atleta.academia}</span>}
              </h2>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="bg-black/40 border border-white/5 rounded-lg p-2 flex flex-col items-center justify-center">
                  <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest mb-0.5">Idade</span>
                  <span className="text-white text-xs font-black">{atleta.nascimento ? `${calcularIdade(atleta.nascimento)} anos` : "--"}</span>
                </div>
                <div className="bg-black/40 border border-white/5 rounded-lg p-2 flex flex-col items-center justify-center">
                  <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest mb-0.5">Peso</span>
                  <span className="text-white text-xs font-black">{atleta.peso ? `${atleta.peso} kg` : "--"}</span>
                </div>
                <div className="bg-black/40 border border-white/5 rounded-lg p-2 flex flex-col items-center justify-center">
                  <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest mb-0.5">Mestre</span>
                  <span className="text-white text-xs font-black truncate w-full text-center">{atleta.professor || "--"}</span>
                </div>
                <div className="bg-black/40 border border-white/5 rounded-lg p-2 flex flex-col items-center justify-center">
                  <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest mb-0.5">Cidade</span>
                  <span className="text-white text-xs font-black truncate w-full text-center">{atleta.cidade || "--"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 🏅 QUADRO DE MEDALHAS OFICIAIS */}
        <h3 className="text-[11px] font-black text-white uppercase tracking-widest mb-3 flex items-center gap-1.5 px-1">
          <svg className="w-3.5 h-3.5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"></path></svg>
          Mural de Conquistas
        </h3>
        <div className="grid grid-cols-3 gap-2 mb-8">
          <div className="bg-gradient-to-br from-yellow-500/10 to-[#050505] border border-yellow-500/20 rounded-xl p-3 flex flex-col items-center justify-center relative overflow-hidden shadow-sm">
            <div className="absolute -right-2 -top-1 text-5xl opacity-10 pointer-events-none">🥇</div>
            <span className="text-3xl font-black text-yellow-500 drop-shadow-sm">{atleta.ouro || 0}</span>
            <span className="text-[9px] font-black text-yellow-600/80 uppercase tracking-widest mt-1">Ouros</span>
          </div>
          <div className="bg-gradient-to-br from-zinc-300/10 to-[#050505] border border-zinc-400/20 rounded-xl p-3 flex flex-col items-center justify-center relative overflow-hidden shadow-sm">
            <div className="absolute -right-2 -top-1 text-5xl opacity-10 pointer-events-none filter grayscale">🥈</div>
            <span className="text-3xl font-black text-zinc-300 drop-shadow-sm">{atleta.prata || 0}</span>
            <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mt-1">Pratas</span>
          </div>
          <div className="bg-gradient-to-br from-orange-700/10 to-[#050505] border border-orange-700/20 rounded-xl p-3 flex flex-col items-center justify-center relative overflow-hidden shadow-sm">
            <div className="absolute -right-2 -top-1 text-5xl opacity-10 pointer-events-none sepia">🥉</div>
            <span className="text-3xl font-black text-orange-500 drop-shadow-sm">{atleta.bronze || 0}</span>
            <span className="text-[9px] font-black text-orange-700/80 uppercase tracking-widest mt-1">Bronzes</span>
          </div>
        </div>

        {/* ⚔️ HISTÓRICO DE CAMPEONATOS */}
        <h3 className="text-[11px] font-black text-white uppercase tracking-widest mb-3 flex items-center gap-1.5 px-1">
          <svg className="w-3.5 h-3.5 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
          Histórico de Eventos
        </h3>
        
        <div className="space-y-2">
          {historico.length === 0 ? (
            <div className="bg-black/30 border border-dashed border-white/5 rounded-xl p-6 text-center">
              <p className="text-zinc-500 text-xs font-medium">Nenhum evento registrado.</p>
            </div>
          ) : (
            historico.map((insc, index) => (
              <div key={index} className="bg-black/40 border border-white/5 rounded-xl p-3 flex items-center gap-3 hover:bg-white/5 transition-colors">
                
                <div className="w-12 h-12 bg-zinc-900 rounded-lg overflow-hidden shrink-0 border border-white/5 relative">
                  {insc.eventos?.banner_url ? (
                    <img src={insc.eventos.banner_url} className="w-full h-full object-cover opacity-70" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-sm opacity-30">🥋</div>
                  )}
                </div>

                <div className="flex-1 overflow-hidden">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-cyan-400 text-[8px] font-black uppercase tracking-widest border border-cyan-500/20 bg-cyan-500/10 px-1.5 py-0.5 rounded">
                      {insc.eventos?.data_evento ? insc.eventos.data_evento.split('-').reverse().join('/') : "S/ Data"}
                    </span>
                  </div>
                  <h4 className="text-white font-bold text-xs leading-tight truncate mb-0.5">
                    {insc.eventos?.nome || "Evento Não Identificado"}
                  </h4>
                  <p className="text-zinc-500 text-[9px] font-bold uppercase tracking-widest truncate">
                    {insc.categoria}
                  </p>
                </div>

              </div>
            ))
          )}
        </div>

      </div>
    </main>
  );
}