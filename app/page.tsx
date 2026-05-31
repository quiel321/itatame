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

  const getCorTema = (status: string, index: number) => {
    const s = status?.toUpperCase() || "ABERTO";
    if (s === "OFICIAL") return "red";
    if (s === "ABERTO") return "yellow";
    if (s === "EM BREVE") return "cyan";
    if (s === "ENCERRADO") return "zinc";
    const coresFallback = ["red", "yellow", "cyan"];
    return coresFallback[index % coresFallback.length];
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
      
      {/* HERO SECTION (Apenas textos e background) */}
      <section className="relative pt-10 pb-16 md:pt-16 md:pb-24 px-6 flex flex-col items-center justify-center">
        
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <img src="/arena.png" alt="Arena Background" className="w-full h-full object-cover opacity-20 scale-105" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#050505]/40 via-[#050505]/80 to-[#050505]"></div>
        </div>

        <div className="max-w-4xl mx-auto text-center relative z-10 flex flex-col items-center w-full">
          <span className="text-red-500 font-extrabold tracking-widest uppercase text-[9px] md:text-[10px] mb-3 block border border-red-500/30 bg-black backdrop-blur-sm px-4 py-1.5 rounded-full shadow-[0_4px_10px_rgba(239,68,68,0.2)]">
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

      {/* ÁREA DE BUSCA E EVENTOS */}
      <section className="flex-1 max-w-7xl w-full mx-auto px-6 pb-20 -mt-8 relative z-20">
        
        {/* BARRA DE PESQUISA (Desceu e formou uma "ponte" entre o banner e os eventos) */}
        <div className="w-full max-w-3xl mx-auto bg-[#0f0f14]/90 backdrop-blur-xl border border-white/10 p-1.5 md:p-2 rounded-2xl md:rounded-full shadow-2xl shadow-black flex flex-col md:flex-row gap-2 mb-12">
          <div className="flex-1 flex items-center px-4 bg-black/60 rounded-xl md:rounded-full border border-white/5 focus-within:border-red-500/50 transition-colors">
            <svg className="w-4 h-4 text-zinc-500 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            <input type="text" placeholder="Nome do evento ou cidade..." value={busca} onChange={(e) => setBusca(e.target.value)} className="w-full bg-transparent border-none outline-none py-2.5 text-white text-xs" />
          </div>
          <div className="flex gap-2 h-[40px] md:h-auto">
            <select value={modalidadeFiltro} onChange={(e) => setModalidadeFiltro(e.target.value)} className="flex-1 bg-black/60 border border-white/5 rounded-xl md:rounded-full px-3 outline-none text-xs text-zinc-300 focus:border-red-500/50 appearance-none">
              <option value="Todas">Esporte</option>
              <option value="Jiu-Jitsu">Jiu-Jitsu</option>
              <option value="No-Gi">No-Gi</option>
              <option value="Judô">Judô</option>
            </select>
            <select value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value)} className="flex-1 bg-black/60 border border-white/5 rounded-xl md:rounded-full px-3 outline-none text-xs text-zinc-300 focus:border-red-500/50 appearance-none">
              <option value="Todos">Local</option>
              <option value="MT">MT</option>
              <option value="SP">SP</option>
              <option value="RJ">RJ</option>
              <option value="RO">RO</option>
            </select>
          </div>
        </div>

        {/* HEADER DOS EVENTOS + BOTÃO PPV DISCRETO */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-6 border-b border-white/5 pb-4 gap-4">
          <div>
            <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-wide">Eventos em Destaque</h2>
            <span className="text-zinc-500 text-xs font-bold mt-1 block">{eventosFiltrados.length} eventos encontrados</span>
          </div>
          
          <Link href="/ppv" className="flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-500 text-[10px] md:text-xs font-bold uppercase tracking-widest px-4 py-2.5 rounded-lg transition-colors shrink-0">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
            TRANSMISSÕES AO VIVO
          </Link>
        </div>

        {/* GRID DE EVENTOS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {eventosFiltrados.length === 0 && (
            <div className="col-span-full text-center py-16 bg-white/5 rounded-2xl border border-dashed border-white/10 text-zinc-500 font-bold text-sm">
              Nenhum evento encontrado no momento.
            </div>
          )}

          {eventosFiltrados.map((evento, index) => {
            const cor = getCorTema(evento.status, index);
            const statusTexto = evento.status?.toUpperCase() || "ABERTO";
            const borderClass = cor === 'red' ? 'border-red-500/20 hover:border-red-500/50' : cor === 'yellow' ? 'border-yellow-500/20 hover:border-yellow-500/50' : 'border-cyan-500/20 hover:border-cyan-500/50';
            const badgeClass = cor === 'red' ? 'bg-red-600 text-white' : cor === 'yellow' ? 'bg-yellow-500 text-black' : 'bg-cyan-500 text-black';
            const btnClass = cor === 'red' ? 'bg-red-600 hover:bg-red-500 text-white' : cor === 'yellow' ? 'bg-yellow-500 hover:bg-yellow-400 text-black' : 'bg-cyan-500 hover:bg-cyan-400 text-black';

            return (
              <div key={evento.id} className={`group relative bg-[#0a0a0e] rounded-[20px] border ${borderClass} transition-all duration-300 hover:-translate-y-1 overflow-hidden flex flex-col`}>
                
                <div className="relative h-[130px] md:h-[140px] overflow-hidden bg-black">
                  <div className={`absolute top-3 right-3 z-20 text-[9px] font-black tracking-wider px-2.5 py-1 rounded-full ${badgeClass}`}>
                    {statusTexto}
                  </div>
                  <img src={evento.banner_url || "/arena.png"} alt={evento.nome} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-90" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0e] via-transparent to-transparent"></div>
                </div>

                <div className="p-5 pt-3 flex flex-col flex-1">
                  <span className="text-zinc-500 text-[10px] font-bold uppercase mb-1 tracking-widest">{evento.descricao || "Jiu-Jitsu"}</span>
                  <h3 className="text-lg font-black text-white mb-4 leading-tight">{evento.nome}</h3>

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

                  <Link href={`/evento/${evento.id}`} className={`w-full text-center mt-auto py-3 rounded-lg text-xs font-black uppercase tracking-widest transition-colors ${btnClass}`}>
                    Ver Evento
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}