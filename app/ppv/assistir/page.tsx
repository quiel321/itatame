"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabase"; 

function ConteudoStreaming() {
  const searchParams = useSearchParams();
  const tokenUrl = searchParams.get("token");

  const [validando, setValidando] = useState(true);
  const [acessoPermitido, setAcessoPermitido] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [tatameFoco, setTatameFoco] = useState<number | null>(null);
  
  const [motivoBloqueio, setMotivoBloqueio] = useState("");

  useEffect(() => {
    const validarTokenNoSupabase = async () => {
      setValidando(true);

      if (!tokenUrl) {
        setAcessoPermitido(false);
        setMotivoBloqueio("Nenhum token de acesso foi fornecido na URL.");
        setValidando(false);
        return;
      }

      const { data, error } = await supabase
        .from('ppv_acessos')
        .select('email, status, criado_em') 
        .eq('token', tokenUrl)
        .single();

      if (error || !data) {
        setAcessoPermitido(false);
        setMotivoBloqueio("O seu token de acesso é inválido ou não foi encontrado em nosso sistema.");
      } 
      else if (data.status === 'pago') {
        const dataEmissao = new Date(data.criado_em); 
        const agora = new Date();
        const horasPassadas = (agora.getTime() - dataEmissao.getTime()) / (1000 * 60 * 60);

        if (horasPassadas > 48) {
          setAcessoPermitido(false);
          setMotivoBloqueio("O seu link de acesso expirou. O período de validade de 48 horas foi encerrado.");
        } else {
          setAcessoPermitido(true);
          setUserEmail(data.email); 
        }
      } 
      else {
        setAcessoPermitido(false);
        setMotivoBloqueio("O pagamento deste acesso ainda consta como pendente.");
      }
      
      setValidando(false);
    };

    validarTokenNoSupabase();
  }, [tokenUrl]);

  const tatames = [
    { id: 1, nome: "TATAME 1", status: "AO VIVO", categoria: "Finais Adulto", videoId: "hSkcAAL0W2o" }, 
    { id: 2, nome: "TATAME 2", status: "AO VIVO", categoria: "Absoluto Juvenil", videoId: "Oo88ScC1QXA" }, 
    { id: 3, nome: "TATAME 3", status: "AO VIVO", categoria: "Master 1 e 2", videoId: "txtjMi6Trps" },
    { id: 4, nome: "TATAME 4", status: "AO VIVO", categoria: "Infantil", videoId: "BznSc631TSU" },
  ];

  const tatameAtual = tatames.find(t => t.id === tatameFoco);

  // TELA DE LOADING
  if (validando) {
    return (
      <div className="min-h-screen bg-[#020202] flex flex-col items-center justify-center text-white">
        <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-zinc-500 text-xs font-black uppercase tracking-widest animate-pulse">A verificar credenciais de acesso...</p>
      </div>
    );
  }

  // TELA DE BLOQUEIO
  if (!acessoPermitido) {
    return (
      <div className="min-h-screen bg-[#050816] flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-red-500/10 blur-[120px] rounded-full pointer-events-none"></div>
        
        <div className="relative bg-[#0a0a0e] border border-white/10 max-w-md w-full p-8 rounded-[32px] shadow-2xl flex flex-col items-center">
          <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(239,68,68,0.1)]">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
          </div>
          
          <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-2">Acesso Bloqueado</h2>
          <p className="text-red-400 font-bold text-sm mb-6 leading-relaxed bg-red-500/10 p-3 rounded-lg border border-red-500/20">
            {motivoBloqueio}
          </p>
          
          <a href="/ppv" className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black font-black uppercase tracking-widest py-4 rounded-xl shadow-lg text-sm transition-transform active:scale-95 block">
            Adquirir Acesso Oficial
          </a>
        </div>
      </div>
    );
  }

  // TELA LIBERADA (RESPONSIVA & MODERNA)
  return (
    <div className="min-h-screen bg-[#020202] text-white font-sans selection:bg-cyan-500/30">
      
      {/* HEADER REFORMULADO - INSPIRADO NO CONCORRENTE, MAS PREMIUM */}
      <header className="header-exclusivo-ppv bg-[#050505] border-b border-white/5 px-4 md:px-8 py-4 flex flex-col gap-3 md:gap-4 sticky top-0 z-50 shadow-2xl">
        
        {/* LINHA 1: Logo e Status Ao Vivo */}
        <div className="flex items-center justify-between">
          <span className="text-white font-black text-xl md:text-2xl italic tracking-tighter">
            <span className="text-red-600">i</span>TATAME
          </span>
          <div className="flex items-center gap-2 bg-red-600/10 border border-red-600/20 px-3 py-1 md:px-4 md:py-1.5 rounded-md md:rounded-lg shadow-[0_0_15px_rgba(220,38,38,0.15)]">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
            <span className="text-red-500 text-[10px] md:text-xs font-black uppercase tracking-widest">Ao Vivo</span>
          </div>
        </div>

        {/* LINHA 2: Título do Evento e Saudações */}
        <div className="flex flex-col gap-1">
          <h1 className="text-xl md:text-3xl font-black text-white tracking-tight leading-tight">
            1º Campeonato de Jiu-Jitsu <span className="hidden md:inline">— Transmissão Oficial</span>
          </h1>
          
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] md:text-sm text-zinc-400 font-medium mt-1">
            <span>Bem-vindo(a), <span className="text-cyan-400 font-bold">{userEmail}</span></span>
            <span className="text-zinc-700 hidden sm:inline">•</span>
            <span className="hidden sm:inline">Transmissão Exclusiva</span>
            <span className="text-zinc-700">•</span>
            <span className="text-red-400/90 flex items-center gap-1 font-bold">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
              Não compartilhe este link
            </span>
          </div>
        </div>
      </header>

      {/* MARCA D'ÁGUA ANTI-PIRATARIA */}
      <div className="fixed inset-0 pointer-events-none z-40 overflow-hidden opacity-[0.03] flex flex-wrap gap-10 md:gap-20 items-center justify-center p-4 md:p-10">
        {Array.from({ length: 15 }).map((_, i) => (
          <span key={i} className="text-lg md:text-2xl font-black uppercase rotate-[-20deg] truncate max-w-full">{userEmail}</span>
        ))}
      </div>

      <main className="max-w-[1600px] mx-auto p-3 md:p-6 relative z-10">
        {tatameFoco === null ? (
          /* MOSAICO GERAL */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 animate-in fade-in duration-500">
            {tatames.map((tatame) => (
              <div key={tatame.id} className="bg-[#0a0a0e] border border-white/10 rounded-2xl overflow-hidden shadow-xl group relative">
                <div className="aspect-video bg-black relative flex items-center justify-center overflow-hidden">
                  
                  <div className="absolute w-[130%] h-[130%] -top-[15%] -left-[15%] pointer-events-none">
                    <iframe
                      src={`https://www.youtube.com/embed/${tatame.videoId}?autoplay=1&mute=1&controls=0&disablekb=1&playsinline=1&modestbranding=1&rel=0&loop=1&playlist=${tatame.videoId}`}
                      className="w-full h-full opacity-80 group-hover:opacity-100 transition-opacity duration-500"
                      allow="autoplay; encrypted-media"
                    ></iframe>
                  </div>
                  
                  <div className="absolute inset-0 z-10 cursor-pointer" onClick={() => setTatameFoco(tatame.id)}></div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 md:to-black/40 pointer-events-none z-20"></div>
                  
                  <div className="absolute top-2 left-2 md:top-4 md:left-4 bg-black/60 backdrop-blur-md px-2 py-1 md:px-3 md:py-1.5 rounded-md md:rounded-lg border border-white/10 flex flex-col pointer-events-none z-30">
                    <span className="text-white font-black text-xs md:text-sm drop-shadow-md">{tatame.nome}</span>
                    <span className="text-zinc-400 text-[8px] md:text-[10px] font-bold uppercase tracking-wider">{tatame.categoria}</span>
                  </div>
                </div>

                <div className="px-3 md:px-4 py-2.5 md:py-3 flex items-center justify-between bg-[#0a0a0e] border-t border-white/5 relative z-30">
                  <div className="flex items-center gap-2 md:gap-3">
                    <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-green-500 rounded-full shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
                    <span className="text-[9px] md:text-xs font-bold text-zinc-400 uppercase tracking-widest">Sinal Excelente</span>
                  </div>
                  <button onClick={() => setTatameFoco(tatame.id)} className="text-yellow-500 hover:text-yellow-400 text-[10px] md:text-xs font-black uppercase tracking-widest transition-colors flex items-center gap-1 md:gap-2 cursor-pointer">
                    Ampliar Tatame
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* TATAME AMPLIADO (FOCO) */
          <div className="animate-in slide-in-from-bottom-4 duration-500">
            <button onClick={() => setTatameFoco(null)} className="mb-3 md:mb-4 flex items-center gap-2 text-zinc-400 hover:text-white font-bold text-xs md:text-sm uppercase tracking-widest transition-colors bg-white/5 hover:bg-white/10 px-3 py-2 md:px-4 md:py-2 rounded-lg w-fit cursor-pointer">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
              Voltar ao Mosaico
            </button>

            <div className="grid lg:grid-cols-[1fr_300px] gap-4 md:gap-6">
              {/* VIDEO PRINCIPAL */}
              <div className="bg-[#0a0a0e] border border-cyan-500/20 rounded-xl md:rounded-2xl overflow-hidden shadow-[0_0_30px_rgba(6,182,212,0.1)] flex flex-col">
                <div className="w-full relative bg-black overflow-hidden" style={{ paddingTop: '56.25%' }}> 
                  <iframe
                    src={`https://www.youtube.com/embed/${tatameAtual?.videoId}?autoplay=1&mute=0&controls=1&rel=0&modestbranding=1&playsinline=1`}
                    className="absolute top-0 left-0 w-full h-full z-10"
                    allow="autoplay; encrypted-media; fullscreen"
                    allowFullScreen
                  ></iframe>
                </div>
                <div className="p-3 md:p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-2 md:gap-4 bg-[#050505]">
                  <div>
                    <h2 className="text-lg md:text-2xl font-black text-white leading-tight">Assistindo {tatameAtual?.nome}</h2>
                    <p className="text-cyan-400 font-bold uppercase tracking-widest text-[10px] md:text-xs mt-0.5 md:mt-1">{tatameAtual?.categoria}</p>
                  </div>
                </div>
              </div>

              {/* LISTA DE OUTROS TATAMES */}
              <div className="flex flex-col gap-2 md:gap-4">
                <h3 className="text-zinc-500 font-black uppercase tracking-widest text-[10px] md:text-xs mb-1 px-1 md:px-0">Trocar de Tatame</h3>
                
                <div className="flex overflow-x-auto pb-4 md:pb-0 md:flex-col gap-3 md:gap-4 snap-x hide-scrollbar-custom">
                  {tatames.filter(t => t.id !== tatameFoco).map((tatame) => (
                    <button key={tatame.id} onClick={() => setTatameFoco(tatame.id)} className="shrink-0 w-[220px] md:w-full snap-start bg-[#0a0a0e] border border-white/5 hover:border-yellow-500/50 rounded-xl overflow-hidden transition-all text-left group cursor-pointer relative">
                      <div className="aspect-video bg-black relative overflow-hidden">
                        <div className="absolute w-[130%] h-[130%] -top-[15%] -left-[15%] pointer-events-none">
                          <iframe src={`https://www.youtube.com/embed/${tatame.videoId}?autoplay=1&mute=1&controls=0&disablekb=1&playsinline=1&modestbranding=1&rel=0&loop=1&playlist=${tatame.videoId}`} className="w-full h-full opacity-40 group-hover:opacity-60 transition-opacity" allow="autoplay"></iframe>
                        </div>
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent pointer-events-none z-10 flex flex-col justify-end p-3">
                         <span className="text-white font-black text-sm">{tatame.nome}</span>
                         <span className="text-zinc-400 text-[9px] font-bold uppercase">{tatame.categoria}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// COMPONENTE PRINCIPAL (INJETANDO CSS)
export default function PPVAssistirPage() {
  useEffect(() => {
    document.body.classList.add('ocultar-nav-global');
    document.documentElement.classList.add('ocultar-nav-global');
    return () => {
      document.body.classList.remove('ocultar-nav-global');
      document.documentElement.classList.remove('ocultar-nav-global');
    };
  }, []);

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        .ocultar-nav-global header:not(.header-exclusivo-ppv),
        .ocultar-nav-global nav:not(.nav-exclusiva-ppv) { display: none !important; }
        .ocultar-nav-global body > div, .ocultar-nav-global body > main, .ocultar-nav-global #__next { padding-top: 0 !important; margin-top: 0 !important; }
        
        .hide-scrollbar-custom::-webkit-scrollbar { display: none; }
        .hide-scrollbar-custom { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />

      <Suspense fallback={
        <div className="min-h-screen bg-[#020202] flex items-center justify-center text-white">
          <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      }>
        <ConteudoStreaming />
      </Suspense>
    </>
  );
}