"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";

export default function Home() {
  const [eventos, setEventos] = useState<any[]>([]);
  const [busca, setBusca] = useState("");
  const [modalidadeFiltro, setModalidadeFiltro] = useState("Todas");
  const [estadoFiltro, setEstadoFiltro] = useState("Todos");

  async function carregarEventos() {
    const { data, error } = await supabase.from("eventos").select("*").order("id", { ascending: false });
    if (!error) setEventos(data || []);
  }

  useEffect(() => { carregarEventos(); }, []);

  const getCorTema = (status: string) => {
    const s = status?.toUpperCase() || "ABERTO";
    if (s === "OFICIAL") return "red";
    if (s === "ABERTO") return "green";
    if (s === "EM BREVE") return "cyan";
    if (s === "ENCERRADO") return "zinc";
    return "green";
  };

  const formatarData = (dataStr: string) => {
    if (!dataStr) return "Data a definir";
    const [ano, mes, dia] = dataStr.split("-");
    return `${dia}/${mes}/${ano}`;
  };

  const eventosFiltrados = eventos.filter((evento) => {
    const matchBusca = evento.nome?.toLowerCase().includes(busca.toLowerCase()) || evento.cidade?.toLowerCase().includes(busca.toLowerCase());
    const matchModalidade = modalidadeFiltro === "Todas" ? true : evento.descricao?.includes(modalidadeFiltro);
    const matchEstado = estadoFiltro === "Todos" ? true : evento.estado === estadoFiltro;
    return matchBusca && matchModalidade && matchEstado;
  });

  return (
    <main className="flex flex-col">
      
      {/* WRAPPER DO FUNDO DA ARENA */}
      <div className="relative w-full flex flex-col">
        
        {/* IMAGEM DE BACKGROUND */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <img src="/arena.png" alt="Arena Background" className="w-full h-full object-cover object-top opacity-40 scale-105" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#050505]/50 to-[#050505]"></div>
        </div>

        {/* HERO SECTION */}
        <section className="relative pt-10 pb-16 md:pt-16 md:pb-24 px-6 flex flex-col items-center justify-center z-10">
          <div className="max-w-4xl mx-auto text-center relative z-10 flex flex-col items-center w-full">
            <span className="text-red-500 font-extrabold tracking-widest uppercase text-[9px] md:text-[10px] mb-3 block border border-red-500/30 bg-black backdrop-blur-sm px-4 py-1.5 rounded-full shadow-[0_4px_10px_rgba(239,68,68,0.2)] cursor-default">
              A nova era das competições
            </span>
            
            <h1 className="text-3xl md:text-5xl font-black mb-3 tracking-tight leading-[1.1] drop-shadow-2xl text-white">
              Encontre o seu <br className="hidden md:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500">Próximo Desafio.</span>
            </h1>
            
            <p className="text-sm text-zinc-300 font-medium max-w-2xl drop-shadow-lg leading-relaxed">
              Inscrições rápidas, chaves inteligentes e resultados em tempo real. O tatame te espera.
            </p>
          </div>
        </section>

        {/* ÁREA DE BUSCA E HEADER DOS EVENTOS */}
        <section className="max-w-7xl w-full mx-auto px-6 relative z-20 -mt-8">
          
          {/* BARRA DE PESQUISA */}
          <div className="w-full max-w-3xl mx-auto bg-[#0f0f14]/90 backdrop-blur-xl border border-white/10 p-1.5 md:p-2 rounded-2xl md:rounded-full shadow-2xl shadow-black flex flex-col md:flex-row gap-2 mb-12">
            <div className="flex-1 flex items-center px-4 bg-black/60 rounded-xl md:rounded-full border border-white/5 focus-within:border-red-500/50 transition-colors cursor-text">
              <svg className="w-4 h-4 text-zinc-500 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
              <input type="text" placeholder="Nome do evento ou cidade..." value={busca} onChange={(e) => setBusca(e.target.value)} className="w-full bg-transparent border-none outline-none py-2.5 text-white text-xs" />
            </div>
            <div className="flex gap-2 h-[40px] md:h-auto">
              <select value={modalidadeFiltro} onChange={(e) => setModalidadeFiltro(e.target.value)} className="cursor-pointer flex-1 bg-black/60 border border-white/5 rounded-xl md:rounded-full px-3 outline-none text-xs text-zinc-300 focus:border-red-500/50 appearance-none">
                <option value="Todas">Modalidade</option>
                <option value="Jiu-Jitsu">Jiu-Jitsu</option>
                <option value="No-Gi">No-Gi</option>
                <option value="Judô">Judô</option>
                <option value="MMA">MMA</option>
                <option value="Seminário / Curso">Seminários</option>
              </select>
              <select value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value)} className="cursor-pointer flex-1 bg-black/60 border border-white/5 rounded-xl md:rounded-full px-3 outline-none text-xs text-zinc-300 focus:border-red-500/50 appearance-none">
                <option value="Todos">Local (UF)</option>
                <option value="MT">MT</option>
                <option value="SP">SP</option>
                <option value="RJ">RJ</option>
                <option value="RO">RO</option>
              </select>
            </div>
          </div>

          {/* HEADER DOS EVENTOS */}
          <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-white/10 pb-4 gap-4">
            <div>
              <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-wide">Eventos em Destaque</h2>
              <span className="text-zinc-500 text-xs font-bold mt-1 block">{eventosFiltrados.length} eventos encontrados</span>
            </div>
            
            <Link href="/ppv" className="cursor-pointer flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-500 text-[10px] md:text-xs font-bold uppercase tracking-widest px-4 py-2.5 rounded-lg transition-colors shrink-0">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
              TRANSMISSÕES AO VIVO
            </Link>
          </div>
        </section>
      </div>

      {/* GRID DE EVENTOS */}
      <section className="flex-1 max-w-7xl w-full mx-auto px-6 pt-8 pb-12 relative z-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {eventosFiltrados.length === 0 && (
            <div className="col-span-full text-center py-16 bg-white/5 rounded-2xl border border-dashed border-white/10 text-zinc-500 font-bold text-sm">
              Nenhum evento encontrado para esta busca.
            </div>
          )}

          {eventosFiltrados.map((evento) => {
            const cor = getCorTema(evento.status);
            const statusTexto = evento.status?.toUpperCase() || "ABERTO";
            
            const borderClass = 
              cor === 'red' ? 'border-red-500/30 hover:border-red-500/60' : 
              cor === 'green' ? 'border-green-500/30 hover:border-green-500/60' : 
              cor === 'cyan' ? 'border-cyan-500/30 hover:border-cyan-500/60' : 
              'border-white/10 hover:border-white/30'; 
              
            const badgeClass = 
              cor === 'red' ? 'bg-red-600 text-white shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 
              cor === 'green' ? 'bg-green-500 text-black shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 
              cor === 'cyan' ? 'bg-cyan-500 text-black shadow-[0_0_10px_rgba(6,182,212,0.5)]' : 
              'bg-zinc-600 text-white'; 
              
            const btnClass = 
              cor === 'red' ? 'bg-red-600 hover:bg-red-500 text-white' : 
              cor === 'green' ? 'bg-green-600 hover:bg-green-500 text-white' : 
              cor === 'cyan' ? 'bg-cyan-600 hover:bg-cyan-500 text-white' : 
              'bg-zinc-800 hover:bg-zinc-700 text-zinc-400'; 

            return (
              <div key={evento.id} className={`group relative bg-[#0a0a0e] rounded-[20px] border ${borderClass} transition-all duration-300 hover:-translate-y-1 overflow-hidden flex flex-col shadow-lg`}>
                
                <div className="relative h-[130px] md:h-[140px] overflow-hidden bg-black cursor-pointer" onClick={() => window.location.href = `/evento/${evento.id}`}>
                  <div className={`absolute top-3 right-3 z-20 text-[9px] font-black tracking-wider px-2.5 py-1 rounded-full ${badgeClass}`}>
                    {statusTexto}
                  </div>
                  <img src={evento.banner_url || "/arena.png"} alt={evento.nome} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-90" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0e] via-transparent to-transparent"></div>
                </div>

                <div className="p-5 pt-3 flex flex-col flex-1">
                  <span className="text-zinc-500 text-[10px] font-bold uppercase mb-1 tracking-widest">{evento.descricao || "Jiu-Jitsu"}</span>
                  <h3 className="text-lg font-black text-white mb-4 leading-tight cursor-pointer hover:text-red-500 transition-colors" onClick={() => window.location.href = `/evento/${evento.id}`}>{evento.nome}</h3>

                  <div className="space-y-2 text-[11px] md:text-xs text-zinc-400 mb-6 font-medium">
                    {evento.cidade && (
                      <div className="flex items-center gap-2">
                        <svg className="w-3.5 h-3.5 text-zinc-600 shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z"/></svg>
                        <span className="truncate">{evento.cidade} {evento.estado ? `- ${evento.estado}` : ""}</span>
                      </div>
                    )}
                    {evento.data_evento && (
                      <div className="flex items-center gap-2">
                        <svg className="w-3.5 h-3.5 text-zinc-600 shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20a2 2 0 002 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10z"/></svg>
                        <span>{formatarData(evento.data_evento)}</span>
                      </div>
                    )}
                  </div>

                  <Link href={`/evento/${evento.id}`} className={`cursor-pointer w-full text-center mt-auto py-3 rounded-lg text-xs font-black uppercase tracking-widest transition-colors ${btnClass}`}>
                    Ver Evento
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* BANNER PLACAR DIGITAL - REDUZIDO */}
      <section className="max-w-7xl w-full mx-auto px-6 pb-12 relative z-20 mt-4">
        <div className="relative bg-gradient-to-br from-[#0a0a0e] to-[#050505] border border-yellow-500/30 rounded-[1.5rem] p-6 md:p-8 overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl">
          
          <div className="absolute top-0 right-0 w-48 h-48 bg-yellow-500/10 blur-[60px] rounded-full pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-yellow-500/5 blur-[60px] rounded-full pointer-events-none"></div>

          <div className="relative z-10 max-w-xl text-center md:text-left flex flex-col items-center md:items-start">
            <span className="text-yellow-500 font-bold uppercase tracking-widest text-[9px] mb-2 block border border-yellow-500/30 bg-yellow-500/10 px-2.5 py-1 rounded-md">
              Para Professores e Academias
            </span>
            <h2 className="text-2xl md:text-3xl font-black text-white mb-3 leading-tight">
              Eleve o nível do seu <br className="hidden md:block"/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600">Treino de Competição</span>
            </h2>
            <p className="text-zinc-400 text-xs md:text-sm leading-relaxed mb-6 max-w-md">
              Simule o ambiente real de campeonato na sua academia. Use o nosso Placar Digital IBJJF de forma 100% gratuita. Funciona na TV, notebook ou tablet.
            </p>
            <Link href="/placar" className="cursor-pointer inline-flex items-center justify-center gap-2 bg-yellow-500 hover:bg-yellow-400 text-black font-black uppercase tracking-widest text-xs px-6 py-3 rounded-xl transition-transform active:scale-95 shadow-[0_0_15px_rgba(234,179,8,0.3)]">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              Abrir Placar Gratuito
            </Link>
          </div>

          <div className="relative z-10 hidden md:flex flex-col items-center justify-center bg-[#050505] border border-zinc-800 rounded-xl p-4 lg:p-6 shadow-2xl transform rotate-2 hover:rotate-0 transition-transform duration-500 w-[220px] lg:w-[280px] shrink-0 pointer-events-none">
            <div className="flex w-full justify-between mb-3 border-b border-zinc-800 pb-3">
               <div className="w-1/2 flex flex-col items-center border-r border-zinc-800">
                  <span className="text-blue-500 text-3xl lg:text-4xl font-black">2</span>
                  <span className="text-blue-500/50 text-[8px] font-bold uppercase mt-1">Pontos</span>
               </div>
               <div className="w-1/2 flex flex-col items-center">
                  <span className="text-red-500 text-3xl lg:text-4xl font-black">0</span>
                  <span className="text-red-500/50 text-[8px] font-bold uppercase mt-1">Pontos</span>
               </div>
            </div>
            <div className="text-yellow-500 font-mono text-3xl lg:text-4xl font-black tracking-tighter drop-shadow-[0_0_10px_rgba(234,179,8,0.5)] bg-zinc-900 px-4 py-1.5 rounded-lg border border-zinc-800">
              05:00
            </div>
          </div>
          
        </div>
      </section>

      {/* SEÇÃO PARCEIROS OFICIAIS */}
      <section className="max-w-7xl w-full mx-auto px-6 pb-16 relative z-20">
        <div className="flex flex-col items-center justify-center border-t border-white/5 pt-12">
          <h3 className="text-zinc-600 font-black uppercase tracking-widest text-[10px] md:text-xs mb-8 text-center cursor-default">
            Parceiros Oficiais do iTatame
          </h3>
          
          <div className="flex flex-wrap justify-center items-center gap-10 md:gap-16 opacity-80">
            <a href="https://spartanbjj.com.br/" target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center grayscale hover:grayscale-0 transition-all duration-500 cursor-pointer group">
              <img src="/logo-spartan.svg" alt="Spartan Jiu-Jitsu" className="h-20 md:h-28 object-contain drop-shadow-2xl group-hover:scale-105 transition-transform" />
            </a>
          </div>
        </div>
      </section>

    </main>
  );
}