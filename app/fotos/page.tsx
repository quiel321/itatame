"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { FotoEvento } from "@/app/lib/fotos";
import { CATEGORIAS_FOTOS, categoriaDaGaleria, nomeCategoriaFotos } from "@/app/lib/fotos-categorias";
import FotosShell from "./_components/FotosShell";
import BuscaFacial from "./_components/BuscaFacial";
import BuscaPorNumero from "./_components/BuscaPorNumero";
import { Home, Camera, Search, CalendarDays, MapPin, ShieldCheck, Images, ChevronLeft, ChevronRight, Bike, Car, Dumbbell, Footprints, GraduationCap, Heart, Music2, BriefcaseBusiness, Trophy, UsersRound } from "lucide-react";

const ICONE_CATEGORIA = {
  "jiu-jitsu": Dumbbell, corrida: Footprints, ciclismo: Bike, futebol: Trophy,
  automobilismo: Car, "outros-esportes": Trophy, casamento: Heart,
  formatura: GraduationCap, show: Music2, corporativo: BriefcaseBusiness,
  "outros-eventos": UsersRound,
} as const;

export default function FotosHomePage() {
  const [eventos, setEventos] = useState<FotoEvento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroGalerias, setErroGalerias] = useState(false);
  const [tentarNovamente, setTentarNovamente] = useState(0);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "abertas" | "em_breve">("todos");
  const [categoriaAtiva, setCategoriaAtiva] = useState("");
  const barraCategoriasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      setCarregando(true);
      setErroGalerias(false);
      const consultar = (comCategoria: boolean) => {
        let consulta = supabase.from("foto_eventos")
          .select(`id, nome, slug, local, cidade, estado, data_evento, capa_url, status, em_breve${comCategoria ? ", categoria" : ""}`)
          .eq("status", "publicado").eq("acesso_por_link", false);
        if (filtro === "em_breve") consulta = consulta.eq("em_breve", true);
        if (filtro === "abertas") consulta = consulta.or("em_breve.is.null,em_breve.eq.false");
        if (comCategoria && categoriaAtiva) consulta = consulta.eq("categoria", categoriaAtiva);
        return consulta.order("data_evento", { ascending: false }).limit(200);
      };
      let resultado = await consultar(true);
      if (resultado.error?.code === "42703") resultado = await consultar(false);

      if (ativo) {
        setEventos((resultado.data || []) as unknown as FotoEvento[]);
        setErroGalerias(Boolean(resultado.error));
        setCarregando(false);
      }
    }

    carregar();
    return () => { ativo = false; };
  }, [filtro, categoriaAtiva, tentarNovamente]);

  const eventosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return eventos.filter((evento) => {
      const correspondeFiltro = filtro === "todos" || (filtro === "em_breve") === Boolean(evento.em_breve);
      const correspondeBusca = !termo || [evento.nome, evento.cidade, evento.estado, evento.local].filter(Boolean).join(" ").toLowerCase().includes(termo);
      return correspondeFiltro && correspondeBusca && (!categoriaAtiva || categoriaDaGaleria(evento) === categoriaAtiva);
    });
  }, [eventos, busca, filtro, categoriaAtiva]);

  const formatarData = (dataStr?: string | null) => {
    if (!dataStr) return "";
    const [ano, mes, dia] = dataStr.split("-");
    return `${dia}/${mes}/${ano}`;
  };

  const scrollToSearch = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.focus();
  };

  // Fotos locais: o fundo não depende do banco nem de serviços externos de imagem.
  const bgPhotos = [
    "/retratt/hero-sports/jiu-jitsu.jpg",
    "/retratt/hero-sports/corrida.jpg",
    "/retratt/hero-sports/futebol.jpg",
    "/retratt/hero-sports/ciclismo.jpg",
    "/retratt/hero-sports/basquete.jpg",
    "/retratt/hero-sports/natacao.jpg",
  ];

  return (
    <FotosShell>
      <main className="min-h-screen bg-[#050505] text-white font-sans selection:bg-retratt/30 pb-24 md:pb-20 overflow-hidden relative">

        {/* 🚀 HERO SECTION IMERSIVA COM MOSAICO (MAIS VISÍVEL E COMPACTA) */}
        <section className="relative flex min-h-[390px] w-full items-center overflow-hidden border-b border-white/5 bg-black py-10 md:min-h-[440px]">

          {/* Fundo Mosaico Tecnológico */}
          <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none overflow-hidden">

            <div className="absolute inset-0 z-0 grid grid-cols-2 grid-rows-3 gap-1.5 p-1.5 opacity-90 md:grid-cols-3 md:grid-rows-2 md:gap-2 md:p-2">
              {bgPhotos.map((foto) => (
                <div key={foto} className="min-h-0 min-w-0 overflow-hidden rounded-md bg-[#0a0a0e]">
                  <img
                    src={foto}
                    className="h-full w-full object-cover"
                    alt=""
                  />
                </div>
              ))}
            </div>

            {/* Overlays Suaves (Camadas extras de preto para o texto brilhar) */}
            <div className="absolute inset-0 z-10 bg-black/55"></div>
            <div className="absolute inset-0 z-10 bg-gradient-to-r from-black/40 via-black/15 to-black/40"></div>

            <div className="absolute top-1/2 left-1/2 z-20 h-[270px] w-[620px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/45 blur-[70px]"></div>
          </div>


          <div className="relative z-30 max-w-4xl mx-auto px-4 md:px-6 flex flex-col items-center text-center">

            <span className="inline-flex items-center gap-1.5 bg-retratt/10 border border-retratt/20 text-retratt px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.2em] mb-3 shadow-[0_0_20px_rgba(255,90,31,0.15)]">
              <Camera size={12} /> Uma plataforma, todos os seus momentos
            </span>

            {/* Fonte Reduzida e Container mais enxuto */}
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black uppercase tracking-tight leading-[1.1] drop-shadow-2xl mb-4">
              Encontre suas fotos.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-retratt to-orange-300 drop-shadow-md">Reviva seus momentos.</span>
            </h1>

            <p className="text-zinc-300 text-xs font-medium max-w-xl mx-auto leading-relaxed mb-5 px-2 drop-shadow-md">
              Dos esportes às celebrações: encontre seu evento ou use uma selfie para localizar suas fotos em segundos.
            </p>

            {/* 🔍 BARRA DE PESQUISA (GLASSMORPHISM COMPACTO) */}
            <div className="w-full max-w-3xl bg-black/60 backdrop-blur-xl border border-white/15 p-1.5 md:p-2 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex flex-col md:flex-row gap-1.5 md:gap-2">
              <div className="flex-1 flex items-center bg-black/50 border border-white/5 rounded-xl px-3 md:px-4 py-1 h-10 md:h-14 focus-within:border-retratt/50 transition-colors">
                <Search size={16} className="text-zinc-400 mr-2 shrink-0" />
                <input
                  id="search-input"
                  type="text"
                  placeholder="Nome do evento, cidade ou local..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="w-full bg-transparent border-none text-xs md:text-sm text-white outline-none placeholder:text-zinc-500 font-medium"
                />
              </div>
              <BuscaFacial triggerClassName="flex h-11 md:h-14 shrink-0 items-center justify-center gap-2 rounded-xl bg-retratt px-4 md:px-6 text-[10px] md:text-[11px] font-black uppercase tracking-widest text-white shadow-[0_0_15px_rgba(255,90,31,0.3)] transition-all hover:bg-retratt" />
              <BuscaPorNumero triggerClassName="flex h-11 md:h-14 shrink-0 items-center justify-center gap-2 rounded-xl border border-orange-400/30 bg-orange-500/10 px-4 md:px-5 text-[10px] font-black uppercase tracking-widest text-orange-300 transition hover:bg-orange-500 hover:text-black" />
            </div>

          </div>
        </section>

        {/* 🏆 EVENTOS RECENTES (GRID COMPACTO) */}
        <section className="relative z-20 max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-10">
          <div className="relative mb-5 border-b border-white/10 px-7" role="group" aria-label="Categorias de eventos">
            <button type="button" aria-label="Categorias anteriores" onClick={() => barraCategoriasRef.current?.scrollBy({ left: -360, behavior: "smooth" })} className="absolute inset-y-0 left-0 z-10 flex w-7 items-center justify-center bg-[#050505] text-zinc-500 hover:text-white"><ChevronLeft size={18} /></button>
            <div ref={barraCategoriasRef} className="flex gap-1 overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <button type="button" aria-pressed={!categoriaAtiva} onClick={() => setCategoriaAtiva("")} className={`flex min-w-20 shrink-0 flex-col items-center gap-1 border-b-2 px-2 py-2 text-[9px] font-bold transition-colors ${!categoriaAtiva ? "border-retratt text-retratt" : "border-transparent text-zinc-400 hover:text-white"}`}><Images size={16} />Todas</button>
              {CATEGORIAS_FOTOS.map((categoria) => {
                const Icone = ICONE_CATEGORIA[categoria.id];
                return <button key={categoria.id} type="button" aria-pressed={categoriaAtiva === categoria.id} onClick={() => setCategoriaAtiva(categoria.id)} className={`flex min-w-24 shrink-0 flex-col items-center gap-1 border-b-2 px-2 py-2 text-[9px] font-bold transition-colors ${categoriaAtiva === categoria.id ? "border-retratt text-retratt" : "border-transparent text-zinc-400 hover:text-white"}`}><Icone size={16} />{categoria.nome}</button>;
              })}
            </div>
            <button type="button" aria-label="Próximas categorias" onClick={() => barraCategoriasRef.current?.scrollBy({ left: 360, behavior: "smooth" })} className="absolute inset-y-0 right-0 z-10 flex w-7 items-center justify-center bg-[#050505] text-zinc-500 hover:text-white"><ChevronRight size={18} /></button>
          </div>
          <div className="mb-4 flex gap-2" role="group" aria-label="Filtrar galerias">
            {([ ["todos", "Todas"], ["abertas", "Abertas"], ["em_breve", "Em breve"] ] as const).map(([valor, rotulo]) => <button key={valor} type="button" aria-pressed={filtro === valor} onClick={() => setFiltro(valor)} className={`rounded-full border px-3 py-2 text-[10px] font-bold ${filtro === valor ? "border-retratt bg-retratt/15 text-retratt" : "border-white/10 text-zinc-400"}`}>{rotulo}</button>)}
          </div>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 mb-6 md:mb-8">
            <div>
              <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight flex items-center gap-2">
                <CalendarDays className="text-retratt" size={20} /> Coberturas Recentes
              </h2>
              <p className="text-[9px] md:text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Últimas galerias publicadas pelos nossos fotógrafos</p>
            </div>
          </div>

          {carregando ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
               {[1, 2, 3, 4].map(i => (
                 <div key={i} className="h-[160px] md:h-[200px] bg-white/5 rounded-2xl animate-pulse border border-white/5"></div>
               ))}
            </div>
          ) : erroGalerias ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center">
              <p className="text-sm text-zinc-300">Não foi possível carregar as galerias.</p>
              <button type="button" onClick={() => setTentarNovamente((valor) => valor + 1)} className="mt-3 rounded-lg border border-retratt/40 px-4 py-2 text-xs text-retratt">Tentar novamente</button>
            </div>
          ) : eventosFiltrados.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] py-20 text-center flex flex-col items-center">
              <Search size={32} className="text-zinc-700 mb-4" />
              <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">Nenhuma galeria encontrada.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
              {eventosFiltrados.map((evento) => (
                <Link key={evento.id} href={`/fotos/evento/${evento.id}`} className="group relative flex flex-col h-[180px] md:h-[220px] rounded-2xl overflow-hidden bg-[#111] border border-white/5 hover:border-retratt/40 transition-all duration-300 shadow-lg hover:shadow-orange-950/10">

                  <div className="absolute inset-0 bg-black z-0">
                    <img
                      src={evento.capa_url || "https://images.unsplash.com/photo-1599552375109-6bc228b3a728?q=80&w=800&auto=format&fit=crop"}
                      alt={evento.nome}
                      className="w-full h-full object-cover opacity-85 md:opacity-60 group-hover:scale-105 group-hover:opacity-95 md:group-hover:opacity-70 transition-all duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent md:from-black/95 md:via-black/40"></div>
                  </div>

                  <div className="relative z-10 flex flex-col h-full p-4 md:p-5">
                    <div className="flex justify-between items-start mb-auto">
                      <span className={`rounded-md border px-1.5 py-0.5 text-[7px] font-black uppercase tracking-wide backdrop-blur-md md:px-2 md:py-1 md:text-[9px] md:tracking-widest ${evento.em_breve ? "border-amber-400/40 bg-amber-500/20 text-amber-200" : "border-emerald-400/40 bg-emerald-500/20 text-emerald-200"}`}>
                        {evento.em_breve ? "Em breve" : "Galeria aberta"}
                      </span>
                      <span className="rounded-md bg-black/65 px-2 py-1 text-[8px] font-bold text-white">{nomeCategoriaFotos(categoriaDaGaleria(evento))}</span>
                    </div>

                    <div className="mt-auto transform transition-transform duration-300 md:group-hover:-translate-y-1">
                      <h3 className="text-xs md:text-sm font-black uppercase tracking-tight text-white mb-2 leading-tight group-hover:text-retratt transition-colors line-clamp-2">
                        {evento.nome}
                      </h3>
                      <div className="flex flex-col gap-1.5 text-[8px] md:text-[9px] text-zinc-400 font-bold uppercase tracking-widest">
                        {evento.data_evento && <span className="flex items-center gap-1.5"><CalendarDays size={12} className="text-zinc-500 shrink-0"/> {formatarData(evento.data_evento)}</span>}
                        {evento.cidade && <span className="flex items-center gap-1.5 truncate"><MapPin size={12} className="text-zinc-500 shrink-0"/> <span className="truncate">{evento.cidade} {evento.estado ? `- ${evento.estado}` : ""}</span></span>}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* 📸 ÁREA DO FOTÓGRAFO (DIRETA E COMPACTA) */}
        <section className="relative z-20 max-w-7xl mx-auto px-4 md:px-6 mb-8 md:mb-12">
          <div className="relative rounded-2xl border border-white/5 bg-[#0a0a0e] overflow-hidden">
            <div className="absolute inset-0 bg-retratt/5 blur-[80px] pointer-events-none"></div>
            <div className="relative z-10 p-4 md:px-6 md:py-4 flex flex-col md:flex-row items-center justify-between gap-4">

              <div className="flex-1 text-center md:text-left">
                <span className="inline-flex items-center gap-1.5 text-retratt font-black text-[8px] md:text-[9px] uppercase tracking-[0.2em] mb-2">
                  <Camera size={12} /> Para Fotógrafos Parceiros
                </span>
                <h2 className="text-base md:text-lg font-black uppercase tracking-tighter leading-tight mb-1 text-white">
                  Venda suas fotos na Retratt
                </h2>
                <p className="text-zinc-400 text-[10px] font-medium leading-relaxed max-w-lg mx-auto md:mx-0">
                  Crie álbuns, publique fotos e acompanhe suas vendas.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto shrink-0">
                <Link href="/fotos/login?perfil=fotografo&next=/fotos/fotografo/dashboard" className="flex items-center justify-center bg-white/5 hover:bg-white/10 text-white border border-white/10 px-6 h-11 md:h-12 rounded-xl text-[9px] font-black uppercase tracking-widest transition-colors">
                  Painel do Fotógrafo
                </Link>
                <Link href="/fotos/fotografo" className="flex items-center justify-center bg-retratt hover:bg-retratt text-black px-6 h-11 md:h-12 rounded-xl text-[9px] font-black uppercase tracking-widest transition-colors shadow-[0_0_15px_rgba(255,90,31,0.2)]">
                  Começar a vender
                </Link>
              </div>

            </div>
          </div>
        </section>

        {/* 📱 NAVIGATION BAR INFERIOR (SÓ APARECE NO MOBILE) */}
        <nav className="md:hidden fixed bottom-0 left-0 w-full bg-[#050505]/95 backdrop-blur-xl border-t border-white/10 z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
          <div className="flex items-center justify-between px-1 h-[72px] pb-safe">

            {/* Início */}
            <Link href="/fotos" className="flex flex-col items-center justify-center w-1/5 text-retratt">
              <Home size={22} className="mb-1.5" />
              <span className="text-[8px] font-black uppercase tracking-widest">Início</span>
            </Link>

            {/* Buscar (Scrolla para o topo) */}
            <button onClick={scrollToSearch} className="flex flex-col items-center justify-center w-1/5 text-zinc-500 hover:text-white transition-colors">
              <Search size={22} className="mb-1.5" />
              <span className="text-[8px] font-black uppercase tracking-widest">Buscar</span>
            </button>

            {/* Compras do Atleta */}
            <Link href="/fotos/comprador" className="flex flex-col items-center justify-center w-1/5 text-zinc-500 hover:text-white transition-colors">
              <Images size={22} className="mb-1.5" />
              <span className="text-[8px] font-black uppercase tracking-widest">Compras</span>
            </Link>

            {/* Painel do Fotógrafo */}
            <Link href="/fotos/fotografo" className="flex flex-col items-center justify-center w-1/5 text-zinc-500 hover:text-white transition-colors">
              <Camera size={22} className="mb-1.5" />
              <span className="text-[8px] font-black uppercase tracking-widest">Fotógrafo</span>
            </Link>

            {/* Painel do Organizador */}
            <Link href="/fotos/organizador" className="flex flex-col items-center justify-center w-1/5 text-zinc-500 hover:text-white transition-colors">
              <ShieldCheck size={22} className="mb-1.5" />
              <span className="text-[8px] font-black uppercase tracking-widest">Org.</span>
            </Link>

          </div>
        </nav>

      </main>
    </FotosShell>
  );
}
