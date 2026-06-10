"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronRight, MapPin, MonitorDot, Radio, Search, ShieldCheck, Swords, Trophy, Users, WalletCards } from "lucide-react";
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

      {/* 🚀 HERO SECTION (COMPACTA) */}
      <div className="relative w-full overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-red-600/10 blur-[150px] rounded-full"></div>
          <img src="/arena.png" alt="Arena" className="w-full h-full object-cover object-top opacity-45 scale-100" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#020202]/60 via-[#020202]/90 to-[#020202]"></div>
        </div>

        <section className="relative z-10 px-4 pt-16 pb-10 md:pt-24 md:pb-12">
          <div className="mx-auto flex max-w-6xl flex-col items-center text-center">

            <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/5 px-4 py-1.5 text-[9px] font-extrabold uppercase tracking-[0.2em] text-red-400 backdrop-blur-md shadow-[0_0_15px_rgba(239,68,68,0.1)]">
              <span className="w-1 h-1 rounded-full bg-red-500 animate-pulse"></span>
              Gestão Inteligente de Competições
            </span>

            <h1 className="text-4xl md:text-[52px] font-extrabold uppercase leading-[0.95] tracking-tighter text-white drop-shadow-lg">
              Venda o Evento.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-red-800">Controle o Tatame.</span>
            </h1>

            <p className="mt-4 max-w-xl text-xs md:text-sm leading-relaxed text-zinc-400 font-medium">
              A plataforma que as maiores federações e organizadores usam para eliminar filas, automatizar o chaveamento e entregar uma experiência premium do início ao fim do campeonato.
            </p>

            <div className="mt-6 flex flex-col sm:flex-row w-full max-w-md gap-3 justify-center">
              <Link href="/demonstracao" className="group inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-red-600 px-5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-white shadow-[0_0_20px_rgba(239,68,68,0.2)] transition-all hover:bg-red-500 hover:-translate-y-0.5">
                Ver demonstração <ChevronRight size={14} className="transition-transform group-hover:translate-x-1" />
              </Link>
              <Link href="/login-organizador" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] backdrop-blur-sm px-5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-white transition-all hover:bg-white/[0.05] hover:border-white/20 hover:-translate-y-0.5">
                Sou Organizador
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-2 md:gap-3 max-w-3xl">
              <HeroSignal icon={<WalletCards size={12} />} title="Pix Integrado" />
              <HeroSignal icon={<Trophy size={12} />} title="Chaves Oficiais" />
              <HeroSignal icon={<MonitorDot size={12} />} title="Mesa Digital" />
              <HeroSignal icon={<Radio size={12} />} title="Resultados Ao Vivo" />
            </div>
          </div>
        </section>

        {/* Pilares */}
        <section className="relative z-20 mx-auto -mt-4 w-full max-w-5xl px-4 md:px-6">
          <div className="grid gap-3 rounded-[1.5rem] border border-white/5 bg-[#0a0a0e]/90 p-3 shadow-xl backdrop-blur-md md:grid-cols-3 md:p-4">
            <SystemPill icon={<ShieldCheck size={16} />} title="Gestão Desportiva" text="Controle absoluto de lotes, regras, pesagem e ranking de academias." />
            <SystemPill icon={<Users size={16} />} title="Experiência do Atleta" text="Inscrição rápida, passaporte QR Code e alertas de luta no celular." />
            <SystemPill icon={<MonitorDot size={16} />} title="Operação de Arena" text="Mesários conectados, placar eletrônico nas TVs e chaves em tempo real." />
          </div>
        </section>
      </div>

      {/* 📅 CALENDÁRIO */}
      <section className="relative z-20 mx-auto w-full max-w-6xl px-4 pt-12 md:px-6 md:pt-16">

        {/* Barra de Busca */}
        <div className="mx-auto mb-8 flex w-full max-w-3xl flex-col gap-2 rounded-2xl border border-white/5 bg-white/[0.01] p-1.5 shadow-lg backdrop-blur-md md:flex-row md:rounded-full">
          <div className="flex flex-1 items-center rounded-xl bg-black/40 px-4 transition-colors focus-within:bg-black/60 md:rounded-full h-11 border border-transparent focus-within:border-white/10">
            <Search size={14} className="mr-2 shrink-0 text-zinc-500" />
            <input type="text" placeholder="Buscar campeonato ou cidade..." value={busca} onChange={(e) => setBusca(e.target.value)} className="w-full border-none bg-transparent text-xs text-white outline-none placeholder:text-zinc-600 font-medium" />
          </div>
          <div className="grid grid-cols-2 gap-2 md:flex md:w-auto h-11 md:h-auto">
            <select value={modalidadeFiltro} onChange={(e) => setModalidadeFiltro(e.target.value)} className="cursor-pointer appearance-none rounded-xl md:rounded-full border border-white/5 bg-black/40 px-4 text-[11px] font-bold text-zinc-300 outline-none transition-colors hover:bg-black/60 focus:border-red-500/50">
              <option value="Todas">Todas Modalidades</option>
              <option value="Jiu-Jitsu">Jiu-Jitsu</option>
              <option value="No-Gi">No-Gi</option>
              <option value="Judô">Judô</option>
              <option value="MMA">MMA</option>
            </select>
            <select value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value)} className="cursor-pointer appearance-none rounded-xl md:rounded-full border border-white/5 bg-black/40 px-4 text-[11px] font-bold text-zinc-300 outline-none transition-colors hover:bg-black/60 focus:border-red-500/50">
              <option value="Todos">Local (UF)</option>
              <option value="MT">Mato Grosso</option>
              <option value="SP">São Paulo</option>
              <option value="RJ">Rio de Janeiro</option>
              <option value="RO">Rondônia</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-b border-white/5 pb-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-1 text-[9px] font-extrabold uppercase tracking-[0.2em] text-red-500">Calendário Oficial</p>
            <h2 className="text-2xl font-extrabold uppercase tracking-tight text-white md:text-3xl">Próximos Desafios</h2>
            <span className="mt-1 block text-[11px] font-medium text-zinc-500">{eventosFiltrados.length} eventos abertos para inscrição</span>
          </div>
          <Link href="/ppv" className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-2.5 text-[9px] font-extrabold uppercase tracking-[0.16em] text-red-400 transition-colors hover:bg-red-500/10">
            <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500"></span></span>
            Painéis Ao Vivo
          </Link>
        </div>
      </section>

      {/* 🏆 LISTAGEM DE EVENTOS */}
      <section className="relative z-20 mx-auto w-full max-w-6xl px-4 pb-12 pt-6 md:px-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {eventosFiltrados.length === 0 && (
            <div className="col-span-full rounded-2xl border border-dashed border-white/10 bg-white/[0.02] py-16 text-center flex flex-col items-center justify-center">
              <CalendarDays size={24} className="text-zinc-700 mb-3" />
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Nenhum evento encontrado.</p>
            </div>
          )}

          {eventosFiltrados.map((evento) => {
            const cor = getCorTema(evento.status);
            const statusTexto = evento.status?.toUpperCase() || "ABERTO";
            const borderClass = cor === "red" ? "border-red-500/20 hover:border-red-500/40" : cor === "green" ? "border-emerald-500/20 hover:border-emerald-500/40" : cor === "cyan" ? "border-cyan-500/20 hover:border-cyan-500/40" : "border-white/5 hover:border-white/10";
            const badgeClass = cor === "red" ? "bg-red-500 text-white" : cor === "green" ? "bg-emerald-500 text-black" : cor === "cyan" ? "bg-cyan-500 text-black" : "bg-zinc-700 text-white";
            const btnClass = cor === "red" ? "bg-red-600 hover:bg-red-500 text-white" : cor === "green" ? "bg-emerald-600 hover:bg-emerald-500 text-white" : cor === "cyan" ? "bg-cyan-600 hover:bg-cyan-500 text-white" : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300";

            return (
              <article key={evento.id} className={`group relative flex overflow-hidden rounded-2xl border bg-[#0a0a0e]/60 backdrop-blur-sm shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${borderClass}`}>
                <Link href={`/evento/${evento.id}`} className="flex w-full flex-col">
                  <div className="relative h-[110px] overflow-hidden bg-black md:h-[120px]">
                    <div className={`absolute right-2.5 top-2.5 z-20 rounded-md px-2 py-0.5 text-[8px] font-extrabold uppercase tracking-widest shadow-md ${badgeClass}`}>{statusTexto}</div>
                    <img src={evento.banner_url || "/arena.png"} alt={evento.nome} className="h-full w-full object-cover opacity-70 transition-transform duration-700 group-hover:scale-105 group-hover:opacity-100" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0e] via-[#0a0a0e]/10 to-transparent"></div>
                  </div>

                  <div className="flex flex-1 flex-col p-4 pt-2">
                    <span className="mb-1 text-[8px] font-extrabold uppercase tracking-[0.15em] text-zinc-500">{evento.descricao || "Jiu-Jitsu"}</span>
                    <h3 className="mb-3 text-sm font-extrabold leading-tight text-white transition-colors group-hover:text-red-400">{evento.nome}</h3>

                    <div className="mb-4 space-y-1.5 text-[11px] font-medium text-zinc-400">
                      {evento.cidade && <div className="flex items-center gap-2"><div className="flex items-center justify-center shrink-0"><MapPin size={10} className="text-zinc-500" /></div><span className="truncate">{evento.cidade} {evento.estado ? `- ${evento.estado}` : ""}</span></div>}
                      {evento.data_evento && <div className="flex items-center gap-2"><div className="flex items-center justify-center shrink-0"><CalendarDays size={10} className="text-zinc-500" /></div><span>{formatarData(evento.data_evento)}</span></div>}
                    </div>

                    <span className={`mt-auto w-full rounded-lg py-2.5 text-center text-[9px] font-extrabold uppercase tracking-widest transition-all ${btnClass}`}>Ver Detalhes</span>
                  </div>
                </Link>
              </article>
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

function HeroSignal({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-white/5 bg-white/[0.02] backdrop-blur-sm px-3 py-2 text-[8px] md:text-[9px] font-extrabold uppercase tracking-[0.14em] text-zinc-300 shadow-sm transition-colors hover:bg-white/[0.05]">
      <span className="text-red-400">{icon}</span>
      {title}
    </div>
  );
}

function SystemPill({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="flex gap-3 rounded-xl border border-white/5 bg-white/[0.01] p-3 hover:bg-white/[0.03] transition-colors">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
        {icon}
      </div>
      <div>
        <h3 className="text-xs font-extrabold uppercase tracking-tight text-white mb-1">{title}</h3>
        <p className="text-[10px] leading-relaxed text-zinc-400 font-medium">{text}</p>
      </div>
    </div>
  );
}
