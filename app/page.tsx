"use client";

import Link from "next/link";
// 1. Adicionado o useRef aqui nas importações
import { useEffect, useMemo, useState, useRef } from "react";
import { CalendarDays, Camera, ChevronRight, CirclePlay, MapPin, MonitorDot, Search, ShieldCheck, Trophy } from "lucide-react";
import { supabase } from "./lib/supabase";
import { obterEtapaEvento, type ResumoLutasEvento, type TomEtapaEvento } from "./lib/evento-etapas";
import { usePublicacaoChaves } from './lib/use-publicacao-chaves';
import TutorialVideoCard from "./components/TutorialVideoCard";
import { canalItatame, tutoriais } from "./lib/tutoriais";
import { normalizarTextoLocalidade } from "./lib/localidades";

const estiloEtapa: Record<TomEtapaEvento, { borda: string; badge: string; barra: string; acao: string }> = {
  cyan: {
    borda: "hover:border-cyan-500/40",
    badge: "border-cyan-400/30 bg-cyan-500/15 text-cyan-300",
    barra: "bg-cyan-400",
    acao: "border-cyan-500/20 bg-cyan-500/10 text-cyan-200",
  },
  emerald: {
    borda: "hover:border-emerald-500/40",
    badge: "border-emerald-400/30 bg-emerald-500/15 text-emerald-300",
    barra: "bg-emerald-400",
    acao: "border-emerald-500/20 bg-emerald-500/10 text-emerald-200",
  },
  amber: {
    borda: "hover:border-amber-500/40",
    badge: "border-amber-400/30 bg-amber-500/15 text-amber-300",
    barra: "bg-amber-400",
    acao: "border-amber-500/20 bg-amber-500/10 text-amber-200",
  },
  violet: {
    borda: "hover:border-violet-500/40",
    badge: "border-violet-400/30 bg-violet-500/15 text-violet-300",
    barra: "bg-violet-400",
    acao: "border-violet-500/20 bg-violet-500/10 text-violet-200",
  },
  blue: {
    borda: "hover:border-blue-500/40",
    badge: "border-blue-400/30 bg-blue-500/15 text-blue-300",
    barra: "bg-blue-400",
    acao: "border-blue-500/20 bg-blue-500/10 text-blue-200",
  },
  red: {
    borda: "hover:border-red-500/40",
    badge: "border-red-400/30 bg-red-500/15 text-red-300",
    barra: "bg-red-500",
    acao: "border-red-500/20 bg-red-500/10 text-red-200",
  },
  zinc: {
    borda: "hover:border-white/20",
    badge: "border-white/15 bg-zinc-700/70 text-zinc-200",
    barra: "bg-zinc-500",
    acao: "border-white/10 bg-zinc-800 text-zinc-300",
  },
};

function proximoResumo(
  resumos: Record<string, ResumoLutasEvento>,
  eventoId: string,
) {
  if (!resumos[eventoId]) {
    resumos[eventoId] = { total: 0, concluidas: 0, emAndamento: 0, pendentes: 0 };
  }
  return resumos[eventoId];
}

export default function Home() {
  const [eventos, setEventos] = useState<any[]>([]);
  const [carregandoEventos, setCarregandoEventos] = useState(true);
  const [erroEventos, setErroEventos] = useState('');
  const carregandoEventosRef = useRef(false);
  const [resumosLutas, setResumosLutas] = useState<Record<string, ResumoLutasEvento>>({});
  const publicacoes = usePublicacaoChaves(eventos.map(e => String(e.id)));
  const [busca, setBusca] = useState("");
  const [modalidadeFiltro, setModalidadeFiltro] = useState("Todas");
  const [estadoFiltro, setEstadoFiltro] = useState("Todos");

  // 2. Criada a referência para o vídeo
  const videoRef = useRef<HTMLVideoElement>(null);

  async function carregarResumoLutas(eventoIds?: string[]) {
    let consulta = supabase.from("chaves").select("evento_id, status_luta");
    if (eventoIds?.length) consulta = consulta.in("evento_id", eventoIds);

    const { data, error } = await consulta;
    if (error) return;

    const proximos: Record<string, ResumoLutasEvento> = {};
    for (const luta of data || []) {
      if (!luta.evento_id) continue;
      const resumo = proximoResumo(proximos, String(luta.evento_id));
      resumo.total += 1;
      if (luta.status_luta === "concluida") resumo.concluidas += 1;
      else if (luta.status_luta === "em_andamento") resumo.emAndamento += 1;
      else resumo.pendentes += 1;
    }
    setResumosLutas(proximos);
  }

  async function carregarEventos() {
    if (carregandoEventosRef.current) return;
    carregandoEventosRef.current = true;
    try {
      const { data, error } = await supabase.from("eventos").select("*").order("data_evento", { ascending: true });
      if (error) throw error;
      setErroEventos('');
      const proximosEventos = data || [];
      setEventos(proximosEventos);
      await carregarResumoLutas(proximosEventos.map((evento) => String(evento.id)));
    } catch {
      setErroEventos('Não foi possível atualizar os campeonatos. Confira a conexão. Tentaremos novamente automaticamente.');
    } finally {
      carregandoEventosRef.current = false;
      setCarregandoEventos(false);
    }
  }

  useEffect(() => {
    carregarEventos();

    const atualizar = () => { carregarEventos(); };
    const canal = supabase
      .channel("home-eventos-tempo-real")
      .on("postgres_changes", { event: "*", schema: "public", table: "chaves" }, atualizar)
      .on("postgres_changes", { event: "*", schema: "public", table: "eventos" }, atualizar)
      .subscribe();
    const intervalo = window.setInterval(atualizar, 15_000);
    const aoVoltar = () => { if (document.visibilityState === 'visible') atualizar(); };
    window.addEventListener('online', aoVoltar);
    window.addEventListener('focus', aoVoltar);
    window.addEventListener('pageshow', aoVoltar);
    document.addEventListener('visibilitychange', aoVoltar);

    return () => {
      window.clearInterval(intervalo);
      window.removeEventListener('online', aoVoltar);
      window.removeEventListener('focus', aoVoltar);
      window.removeEventListener('pageshow', aoVoltar);
      document.removeEventListener('visibilitychange', aoVoltar);
      supabase.removeChannel(canal);
    };
  }, []);

  // 3. O motor de arranque: Força o vídeo a reproduzir assim que a página é montada
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch((error) => {
        console.log("O navegador pausou o autoplay no first-paint. A aguardar interação:", error);
      });
    }
  }, []);

  const formatarData = (dataStr: string) => {
    if (!dataStr) return "Data a definir";
    const [ano, mes, dia] = dataStr.split("-");
    return dia && mes && ano ? `${dia}/${mes}/${ano}` : "Data a definir";
  };

  const eventosFiltrados = useMemo(() => eventos.filter((evento) => {
    const termo = normalizarTextoLocalidade(busca);
    const matchBusca = normalizarTextoLocalidade(String(evento.nome || "")).includes(termo) || normalizarTextoLocalidade(String(evento.cidade || "")).includes(termo);
    const matchModalidade = modalidadeFiltro === "Todas" ? true : evento.descricao?.includes(modalidadeFiltro);
    const matchEstado = estadoFiltro === "Todos" ? true : String(evento.estado || "").toUpperCase() === estadoFiltro;
    return matchBusca && matchModalidade && matchEstado;
  }), [busca, estadoFiltro, eventos, modalidadeFiltro]);
  const estadosDisponiveis = useMemo(() => [...new Set(eventos.map((evento) => String(evento.estado || "").trim().toUpperCase()).filter((uf) => /^[A-Z]{2}$/.test(uf)))].sort(), [eventos]);

  return (
    <main className="flex flex-col min-h-screen bg-[#020202] text-white selection:bg-red-500/30 overflow-x-hidden font-sans">

      {/* 🚀 HERO SECTION */}
<section className="relative h-[55vh] min-h-[400px] md:h-[60vh] md:min-h-[460px] w-full flex items-center justify-center">
  
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

    <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
      <Link href="/demonstracao" className="inline-flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-600/15 px-4 py-3 text-[9px] font-black uppercase tracking-[0.16em] text-red-200 backdrop-blur-md transition hover:-translate-y-0.5 hover:bg-red-600 hover:text-white">
        <MonitorDot size={14} /> Conheça o iTatame <ChevronRight size={13} />
      </Link>
    </div>

    <div className="mt-4 md:mt-12 mx-auto flex w-full max-w-3xl flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.05] p-2 shadow-2xl backdrop-blur-md md:flex-row md:rounded-full">
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
          {estadosDisponiveis.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
        </select>
      </div>
    </div>
  </div>
</section>

      <section className="relative z-20 mx-auto w-full max-w-7xl px-4 pb-8 pt-6 md:px-8 md:pt-8">
        
        <div className="flex items-center justify-between mb-5">
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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {erroEventos && <div role="alert" className="col-span-full rounded-2xl border border-amber-400/40 bg-amber-950/40 p-4 text-sm text-amber-100">
            <p>{erroEventos}</p>
            <button type="button" onClick={() => void carregarEventos()} className="mt-3 min-h-11 rounded-lg border border-amber-300/40 px-4 font-bold">Tentar novamente</button>
          </div>}
          {carregandoEventos && <p role="status" className="col-span-full py-10 text-center text-zinc-400">Carregando campeonatos…</p>}
          {!carregandoEventos && !erroEventos && eventosFiltrados.length === 0 && (
            <div className="col-span-full rounded-3xl border border-dashed border-white/10 bg-white/[0.02] py-20 text-center flex flex-col items-center justify-center">
              <CalendarDays size={32} className="text-zinc-700 mb-4" />
              <p className="text-sm font-bold text-zinc-500 uppercase tracking-widest">Nenhum evento encontrado.</p>
            </div>
          )}

          {eventosFiltrados.map((evento) => {
            const etapa = obterEtapaEvento(evento, new Date(), resumosLutas[String(evento.id)], publicacoes[String(evento.id)]);
            const estilo = estiloEtapa[etapa.tom];
            const lutasEmAndamento = resumosLutas[String(evento.id)]?.emAndamento || 0;

            return (
              <Link 
                href={`/evento/${evento.id}`} 
                key={evento.id}
                className={`group mx-auto flex w-full max-w-sm flex-col bg-[#0a0a0e] border border-white/10 rounded-3xl overflow-hidden transition-all duration-500 shadow-xl hover:shadow-[0_10px_40px_rgba(0,0,0,0.5)] hover:-translate-y-1 ${estilo.borda}`}
              >
                {/* Banner Largo do Evento */}
                <div className="relative h-40 sm:h-44 overflow-hidden bg-black">
                  <div className={`absolute top-3 left-3 z-20 rounded-md border px-2 py-1 text-[8px] font-black uppercase tracking-wide shadow-lg backdrop-blur-md ${estilo.badge}`}>
                     {etapa.titulo}
                  </div>
                  {lutasEmAndamento > 0 && <span className="absolute right-4 top-4 z-20 flex items-center gap-2 rounded-lg border border-red-400/40 bg-red-950/90 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-red-100 shadow-[0_0_24px_rgba(239,68,68,0.35)] backdrop-blur-md"><span className="h-2 w-2 animate-pulse rounded-full bg-red-400" />{lutasEmAndamento} ao vivo <MonitorDot size={13} /></span>}
                  <img 
                    src={evento.banner_url || "/arena.png"} 
                    alt={evento.nome} 
                    className="w-full h-full object-cover opacity-80 transition-transform duration-700 group-hover:scale-105 group-hover:opacity-100"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0e] via-transparent to-transparent"></div>
                </div>

                <div className="p-3 flex flex-col flex-1 relative -mt-3 bg-[#0a0a0e]/90 backdrop-blur-md rounded-t-3xl border-t border-white/5">
                  <span className="mb-1 text-[9px] font-extrabold uppercase tracking-[0.15em] text-zinc-500">{evento.descricao || "Jiu-Jitsu"}</span>
                  <h3 className="text-sm font-black uppercase tracking-tight text-white mb-1.5 line-clamp-2 leading-snug group-hover:text-red-400 transition-colors">
                    {evento.nome}
                  </h3>
                  
                  <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 mb-2">
                    {evento.data_evento && (
                       <div className="flex items-center gap-1.5 text-[10px] font-medium text-zinc-400">
                         <CalendarDays size={13} className="text-red-500 shrink-0" /> {formatarData(evento.data_evento)}
                       </div>
                    )}
                    {evento.cidade && (
                       <div className="flex items-center gap-1.5 text-[10px] font-medium text-zinc-400">
                         <MapPin size={13} className="text-red-500 shrink-0" /> <span className="truncate">{evento.cidade} {evento.estado ? `- ${evento.estado}` : ""}</span>
                       </div>
                    )}
                  </div>

                  <div className="mb-1.5">
                    <div className="mb-1 flex items-center justify-between text-[8px] font-black uppercase tracking-[0.16em] text-zinc-500">
                      <span>{etapa.rotuloProgresso || (etapa.indice === 0 ? "Preparação" : `Etapa ${etapa.indice} de ${etapa.totalEtapas}`)}</span>
                      <span>{etapa.progresso}%</span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-white/5">
                      <div className={`h-full rounded-full transition-all ${estilo.barra}`} style={{ width: `${etapa.progresso}%` }} />
                    </div>
                  </div>

                  <div className={`flex w-full items-center justify-center gap-2 rounded-lg border py-1.5 text-center transition-colors ${estilo.acao}`}>
                    <span className="flex flex-col">
                      <strong className="text-[9px] font-black uppercase tracking-wide">{etapa.titulo}</strong>
                      <small className="mt-0.5 text-[7px] font-bold tracking-wide opacity-75">{etapa.detalhe}</small>
                    </span>
                    <ChevronRight size={14} />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        <section aria-labelledby="tutoriais-titulo" className="mt-10 border-t border-white/10 pt-8">
          <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-red-400">
                <CirclePlay size={16} /> Aprenda com o iTatame
              </p>
              <h2 id="tutoriais-titulo" className="text-2xl font-black uppercase tracking-tight text-white md:text-3xl">
                Assista aos <span className="text-red-500">tutoriais</span>
              </h2>
              <p className="mt-2 max-w-2xl text-xs leading-relaxed text-zinc-400 sm:text-sm">
                Do primeiro cadastro à inscrição no campeonato: veja o passo a passo em vídeo.
              </p>
            </div>
            <Link href="/tutoriais" className="inline-flex w-fit items-center gap-1 text-[10px] font-black uppercase tracking-widest text-red-400 transition hover:text-red-300">
              Ver todos os tutoriais <ChevronRight size={16} />
            </Link>
          </div>

          <div className="mx-auto grid max-w-4xl justify-items-center gap-4 md:grid-cols-2">
            {tutoriais.slice(0, 2).map((tutorial) => <div key={tutorial.numero} className="w-full max-w-sm md:max-w-none"><TutorialVideoCard tutorial={tutorial} /></div>)}
          </div>

          <a href={canalItatame} target="_blank" rel="noopener noreferrer" className="mt-6 flex flex-col gap-4 rounded-2xl border border-white/10 bg-[#101013] p-5 transition hover:border-red-500/35 sm:flex-row sm:items-center sm:justify-between">
            <span className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-600 text-white"><CirclePlay size={21} /></span>
              <span>
                <strong className="block text-xs font-black text-white">Canal iTatame Sistemas</strong>
                <small className="mt-1 block text-[11px] text-zinc-400">Novos tutoriais e dicas para usar a plataforma.</small>
              </span>
            </span>
            <span className="text-[10px] font-black uppercase tracking-widest text-red-400">Acessar canal ↗</span>
          </a>
        </section>


      </section>

      <section className="relative z-20 mx-auto w-full max-w-6xl px-4 pb-10 md:px-6" aria-labelledby="parceiros-titulo">
        <div className="border-t border-white/10 pt-6">
          <h3 id="parceiros-titulo" className="mb-4 text-sm font-semibold text-white">Parceiros oficiais</h3>
          <div className="grid gap-3 md:grid-cols-3">
            <a href={process.env.NEXT_PUBLIC_FOTOS_URL || "https://retratt.com"} className="group relative flex min-h-40 flex-col justify-center overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-[#25140c] via-[#15100d] to-[#0a0a0e] p-4 transition hover:border-orange-400/40">
              <Camera size={112} strokeWidth={1} className="pointer-events-none absolute -bottom-5 -right-3 -rotate-12 text-orange-400/[0.08]" aria-hidden="true" />
              <div className="absolute -right-10 -top-16 h-40 w-40 rounded-full bg-orange-500/10 blur-3xl" aria-hidden="true" />
              <img src="/retratt/logo-white.svg" alt="Retratt" className="relative mb-3 h-5 w-20 object-contain object-left" />
              <strong className="relative text-sm font-bold text-white">Seu melhor momento merece uma foto.</strong>
              <span className="relative mt-1 text-[11px] leading-relaxed text-zinc-400">Encontre suas fotos e reviva cada conquista.</span>
              <span className="relative mt-3 inline-flex items-center gap-1 text-xs font-semibold text-orange-400 group-hover:text-orange-300">Encontrar minhas fotos <ChevronRight size={13} /></span>
            </a>
            <a href="https://spartanbjj.com.br/" target="_blank" rel="noopener noreferrer" className="group relative flex min-h-40 items-center gap-3 overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-[#141112] to-[#0a0a0e] p-3 transition hover:border-red-400/30">
              <img src="/logo-spartan.svg" alt="" aria-hidden="true" className="pointer-events-none absolute -right-5 -bottom-8 h-36 w-36 object-contain opacity-[0.05]" />
              <span className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/40"><img src="/logo-spartan.svg" alt="Spartan Jiu-Jitsu" className="h-14 w-14 object-contain" /></span>
              <span className="relative"><span className="mb-1 block text-[8px] font-bold uppercase tracking-widest text-red-400">No esporte, juntos</span><strong className="block text-sm font-semibold text-white">Spartan Jiu-Jitsu</strong><span className="mt-0.5 block text-[11px] text-zinc-400">Parceiro oficial iTatame</span><span className="mt-2 inline-flex items-center gap-1 text-xs text-zinc-200 group-hover:text-red-300">Conhecer <ChevronRight size={13} /></span></span>
            </a>
            <a href="https://www.atalhogratis.com.br" target="_blank" rel="noopener noreferrer" className="group relative flex min-h-40 items-center gap-3 overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-[#0d1829] to-[#0a0a0e] p-3 transition hover:border-blue-400/30">
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-blue-400/20 bg-blue-400/10 text-blue-400"><ShieldCheck size={32} aria-hidden="true" /></span>
              <span className="min-w-0"><span className="mb-1 block text-[8px] font-bold uppercase tracking-widest text-blue-400">Seus atalhos</span><strong className="block text-sm font-semibold text-white">Atalhos<span className="text-blue-400">Grátis</span></strong><span className="mt-0.5 block text-[11px] text-zinc-400">Sistemas e serviços em um só lugar.</span><span className="mt-2 inline-flex items-center gap-1 text-xs text-zinc-200 group-hover:text-blue-300">Conhecer <ChevronRight size={13} /></span></span>
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
