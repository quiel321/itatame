"use client";

import Link from "next/link";
// 1. Adicionado o useRef aqui nas importações
import { useEffect, useMemo, useState, useRef } from "react";
import { CalendarDays, ChevronRight, MapPin, MonitorDot, Search, ShieldCheck, Trophy, Users } from "lucide-react";
import { supabase } from "./lib/supabase";

export default function Home() {
  const [eventos, setEventos] = useState<any[]>([]);
  const [busca, setBusca] = useState("");
  const [modalidadeFiltro, setModalidadeFiltro] = useState("Todas");
  const [estadoFiltro, setEstadoFiltro] = useState("Todos");

  // 2. Criada a referência para o vídeo
  const videoRef = useRef<HTMLVideoElement>(null);

  async function carregarEventos() {
    const { data, error } = await supabase.from("eventos").select("*").order("data_evento", { ascending: true });
    if (!error) setEventos(data || []);
  }

  useEffect(() => { carregarEventos(); }, []);

  // 3. O motor de arranque: Força o vídeo a reproduzir assim que a página é montada
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch((error) => {
        console.log("O navegador pausou o autoplay no first-paint. A aguardar interação:", error);
      });
    }
  }, []);

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
    return dia && mes && ano ? `${dia}/${mes}/${ano}` : "Data a definir";
  };

  const eventosFiltrados = useMemo(() => eventos.filter((evento) => {
    const termo = busca.toLowerCase();
    const matchBusca = evento.nome?.toLowerCase().includes(termo) || evento.cidade?.toLowerCase().includes(termo);
    const matchModalidade = modalidadeFiltro === "Todas" ? true : evento.descricao?.includes(modalidadeFiltro);
    const matchEstado = estadoFiltro === "Todos" ? true : evento.estado === estadoFiltro;
    return matchBusca && matchModalidade && matchEstado;
  }), [busca, estadoFiltro, eventos, modalidadeFiltro]);

  return (
    <main className="flex flex-col min-h-screen bg-[#020202] text-white selection:bg-red-500/30 overflow-x-hidden font-sans">

     {/* 🚀 HERO SECTION */}
<section className="relative h-[60vh] min-h-[400px] md:h-[75vh] md:min-h-[550px] w-full flex items-center justify-center">
  
  <div className="absolute -top-2 md:-top-1 bottom-0 left-0 right-0 bg-[#020202] pointer-events-none overflow-hidden">
    
    <video 
      ref={videoRef} /* 4. Referência conectada ao vídeo aqui! */
      autoPlay 
      loop 
      muted 
      playsInline 
      className="absolute top-0 -left-[30%] w-[170%] max-w-none h-auto md:left-0 md:w-full md:max-w-full md:h-full md:object-cover md:object-[center_0%] opacity-100"
      style={{
        WebkitMaskImage: 'linear-gradient(to bottom, black 70%, transparent 98%)',
        maskImage: 'linear-gradient(to bottom, black 70%, transparent 98%)'
      }}
    >
      <source src="/video-hero.mp4" type="video/mp4" />
    </video>

    {/* O gradiente agora serve apenas para escurecer suavemente o fundo atrás dos textos, pois o vídeo já faz o seu próprio fade! */}
    <div className="absolute inset-0 bg-gradient-to-t from-[#020202] via-[#020202]/80 md:via-[#020202]/50 to-transparent"></div>
  </div>

  {/* Conteúdo Central */}
  <div className="relative z-10 w-full max-w-5xl mx-auto px-4 text-center pt-28 md:pt-0">
    
    <span className="inline-flex items-center gap-1.5 md:gap-2 bg-red-600/20 border border-red-500/30 text-red-400 px-3 md:px-4 py-1 md:py-1.5 rounded-full text-[7px] md:text-[8px] font-black uppercase tracking-[0.25em] mb-3 md:mb-4 backdrop-blur-sm shadow-lg">
      <Trophy size={10} className="md:w-3 md:h-3" /> Sistema Oficial de Competições
    </span>
    
    <h1 className="text-xl md:text-3xl font-black text-white/90 uppercase tracking-widest leading-snug md:leading-tight drop-shadow-xl">
      O Seu Próximo <br className="hidden md:block" /> 
      <span className="text-red-500/90 drop-shadow-lg">Desafio Começa Aqui.</span>
    </h1>
    
    <p className="mt-2 md:mt-4 text-[9px] md:text-xs text-zinc-200/90 font-medium max-w-lg mx-auto drop-shadow-lg px-2">
      Inscreva-se nos maiores campeonatos de Artes marciais e consolide o seu nome no ranking.
    </p>

    <div className="mt-4 md:mt-24 mx-auto flex w-full max-w-3xl flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.05] p-2 shadow-2xl backdrop-blur-md md:flex-row md:rounded-full">
      <div className="flex flex-1 items-center rounded-xl bg-black/40 px-4 transition-colors focus-within:bg-black/80 md:rounded-full h-12 border border-transparent focus-within:border-red-500/50">
        <Search size={16} className="mr-3 shrink-0 text-zinc-300" />
        
        <input 
          type="text" 
          placeholder="Buscar por campeonato ou cidade..." 
          value={busca} 
          onChange={(e) => setBusca(e.target.value)} 
          className="w-full border-none bg-transparent text-sm text-white outline-none placeholder:text-zinc-400 font-bold drop-shadow-md" 
        />
      </div>

      <div className="grid grid-cols-2 gap-2 md:flex md:w-auto h-12 md:h-auto">
        <select 
          value={modalidadeFiltro} 
          onChange={(e) => setModalidadeFiltro(e.target.value)} 
          className="cursor-pointer appearance-none rounded-xl md:rounded-full border border-white/5 bg-black/40 px-5 text-xs font-bold text-zinc-300 outline-none transition-colors hover:bg-black/60 focus:border-red-500/50"
        >
          <option value="Todas">Todas Modalidades</option>
          <option value="Jiu-Jitsu">Jiu-Jitsu</option>
          <option value="No-Gi">No-Gi</option>
          <option value="Judô">Judô</option>
          <option value="MMA">MMA</option>
        </select>

        <select 
          value={estadoFiltro} 
          onChange={(e) => setEstadoFiltro(e.target.value)} 
          className="cursor-pointer appearance-none rounded-xl md:rounded-full border border-white/5 bg-black/40 px-5 text-xs font-bold text-zinc-300 outline-none transition-colors hover:bg-black/60 focus:border-red-500/50"
        >
          <option value="Todos">Local (UF)</option>
          <option value="MT">Mato Grosso</option>
          <option value="SP">São Paulo</option>
          <option value="RJ">Rio de Janeiro</option>
          <option value="RO">Rondônia</option>
        </select>
      </div>
    </div>
  </div>
</section>

{/* 🚀 PILARES */}
<section className="relative z-20 mx-auto w-full max-w-5xl px-4 md:px-6 mt-2 md:-mt-16">
  <div className="grid gap-2.5 rounded-[1.5rem] border border-white/10 bg-[#0a0a0e]/90 p-2.5 shadow-2xl backdrop-blur-xl md:gap-3 md:p-4 md:grid-cols-3">
    
    <SystemPill
      icon={<ShieldCheck size={16} />}
      title="Gestão Oficial"
      text="Campeonatos validados com arbitragem qualificada."
    />

    <SystemPill
      icon={<Users size={16} />}
      title="Experiência do Atleta"
      text="Inscrição rápida, passaporte QR Code e alertas de luta."
    />

    <SystemPill
      icon={<MonitorDot size={16} />}
      title="Operação de Arena"
      text="Placar eletrônico nas TVs e chaves em tempo real."
    />

  </div>
</section>

      <section className="relative z-20 mx-auto w-full max-w-7xl px-4 pb-12 pt-16 md:px-8">
        
        <div className="flex items-center justify-between mb-8">
          <div>
             <p className="mb-1 text-[9px] font-extrabold uppercase tracking-[0.2em] text-red-500 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span> Calendário
             </p>
             <h2 className="text-2xl font-extrabold uppercase tracking-tight text-white md:text-3xl">Próximos Campeonatos</h2>
          </div>
          <Link href="/eventos" className="hidden md:flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-colors">
            Ver Todos <ChevronRight size={14} />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {eventosFiltrados.length === 0 && (
            <div className="col-span-full rounded-3xl border border-dashed border-white/10 bg-white/[0.02] py-20 text-center flex flex-col items-center justify-center">
              <CalendarDays size={32} className="text-zinc-700 mb-4" />
              <p className="text-sm font-bold text-zinc-500 uppercase tracking-widest">Nenhum evento encontrado.</p>
            </div>
          )}

          {eventosFiltrados.map((evento) => {
            const cor = getCorTema(evento.status);
            const statusTexto = evento.status?.toUpperCase() || "ABERTO";
            const borderClass = cor === "red" ? "hover:border-red-500/40" : cor === "green" ? "hover:border-emerald-500/40" : cor === "cyan" ? "hover:border-cyan-500/40" : "hover:border-white/20";
            const badgeClass = cor === "red" ? "bg-red-600 text-white" : cor === "green" ? "bg-emerald-600 text-black" : cor === "cyan" ? "bg-cyan-600 text-black" : "bg-zinc-700 text-white";
            const btnClass = cor === "red" ? "bg-red-600 hover:bg-red-500 text-white" : cor === "green" ? "bg-emerald-600 hover:bg-emerald-500 text-white" : cor === "cyan" ? "bg-cyan-600 hover:bg-cyan-500 text-white" : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300";

            return (
              <Link 
                href={`/evento/${evento.id}`} 
                key={evento.id}
                className={`group flex flex-col bg-[#0a0a0e] border border-white/10 rounded-3xl overflow-hidden transition-all duration-500 shadow-xl hover:shadow-[0_10px_40px_rgba(0,0,0,0.5)] hover:-translate-y-1 ${borderClass}`}
              >
                {/* Banner Largo do Evento */}
                <div className="relative h-48 md:h-56 overflow-hidden bg-black">
                  <div className={`absolute top-4 left-4 z-20 rounded-lg px-3 py-1.5 text-[9px] font-black uppercase tracking-widest shadow-lg ${badgeClass}`}>
                     {statusTexto}
                  </div>
                  <img 
                    src={evento.banner_url || "/arena.png"} 
                    alt={evento.nome} 
                    className="w-full h-full object-cover opacity-80 transition-transform duration-700 group-hover:scale-105 group-hover:opacity-100"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0e] via-transparent to-transparent"></div>
                </div>

                <div className="p-6 flex flex-col flex-1 relative -mt-6 bg-[#0a0a0e]/90 backdrop-blur-md rounded-t-3xl border-t border-white/5">
                  <span className="mb-2 text-[9px] font-extrabold uppercase tracking-[0.15em] text-zinc-500">{evento.descricao || "Jiu-Jitsu"}</span>
                  <h3 className="text-base font-black uppercase tracking-tight text-white mb-4 line-clamp-2 leading-snug group-hover:text-red-400 transition-colors">
                    {evento.nome}
                  </h3>
                  
                  <div className="mt-auto space-y-3 mb-6">
                    {evento.data_evento && (
                       <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                         <CalendarDays size={16} className="text-red-500 shrink-0" /> {formatarData(evento.data_evento)}
                       </div>
                    )}
                    {evento.cidade && (
                       <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                         <MapPin size={16} className="text-red-500 shrink-0" /> <span className="truncate">{evento.cidade} {evento.estado ? `- ${evento.estado}` : ""}</span>
                       </div>
                    )}
                  </div>

                  <div className={`w-full text-center py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2 ${btnClass}`}>
                    Inscreva-se Agora <ChevronRight size={14} />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* 🤝 PARCEIROS OFICIAIS */}
      <section className="relative z-20 mx-auto w-full max-w-6xl px-4 pb-12 md:px-6">
        <div className="flex flex-col items-center justify-center border-t border-white/5 pt-10">
          <h3 className="mb-6 text-center text-[9px] font-extrabold uppercase tracking-[0.2em] text-zinc-600">Parceiros Oficiais</h3>
          <div className="flex flex-wrap items-center justify-center gap-10 opacity-70 md:gap-16">
            <a href="https://spartanbjj.com.br/" target="_blank" rel="noopener noreferrer" className="group flex items-center justify-center grayscale transition-all duration-500 hover:grayscale-0 hover:opacity-100">
              <img src="/logo-spartan.svg" alt="Spartan Jiu-Jitsu" className="h-14 md:h-16 object-contain transition-transform group-hover:scale-105" />
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}

function SystemPill({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    // p-3 e gap-3 no mobile, p-4 e gap-4 no desktop
    <div className="flex gap-3 md:gap-4 rounded-xl border border-white/5 bg-white/[0.02] p-3 md:p-4 hover:bg-white/[0.05] transition-colors">
      
      {/* h-8 w-8 no mobile (menor), h-10 w-10 no desktop */}
      <div className="flex h-8 w-8 md:h-10 md:w-10 shrink-0 items-center justify-center rounded-lg md:rounded-xl bg-red-500/10 border border-red-500/20 text-red-500">
        {icon}
      </div>
      
      <div className="flex-1">
        <h3 className="text-[10px] md:text-xs font-black uppercase tracking-tight text-white mb-0.5 md:mb-1.5">{title}</h3>
        <p className="text-[9px] md:text-[10px] leading-relaxed text-zinc-400 font-medium">{text}</p>
      </div>
    </div>
  );
}