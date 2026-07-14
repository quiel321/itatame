"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { FotoEvento } from "@/app/lib/fotos";
import FotosShell from "./_components/FotosShell";
import BuscaFacial from "./_components/BuscaFacial";
import { Home, Camera, Search, CalendarDays, MapPin, ArrowRight, ShieldCheck, Images } from "lucide-react";

export default function FotosHomePage() {
  const [eventos, setEventos] = useState<FotoEvento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    async function carregar() {
      setCarregando(true);
      const { data } = await supabase
        .from("foto_eventos")
        .select("id, nome, slug, local, cidade, estado, data_evento, capa_url, status")
        .eq("status", "publicado")
        .order("data_evento", { ascending: false })
        .limit(12);

      setEventos((data || []) as FotoEvento[]);
      setCarregando(false);
    }

    carregar();
  }, []);

  const eventosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return eventos;
    return eventos.filter((evento) => [evento.nome, evento.cidade, evento.estado, evento.local].filter(Boolean).join(" ").toLowerCase().includes(termo));
  }, [eventos, busca]);

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

  // Fotos de Artes Marciais/Combate garantidas
  const bgPhotos = [
    "https://loremflickr.com/400/400/jiujitsu,fight?lock=44",
    "https://loremflickr.com/400/400/bjj,grappling?lock=22",
    "https://loremflickr.com/400/400/martialarts,mma?lock=33",
    "https://loremflickr.com/400/400/jiujitsu,fight?lock=44",
    "https://loremflickr.com/400/400/judo,wrestling?lock=55",
    "https://loremflickr.com/400/400/bjj,tatame?lock=66",
    "https://loremflickr.com/400/400/mma,boxing?lock=77",
    "https://loremflickr.com/400/400/grappling,submission?lock=88",
  ];

  return (
    <FotosShell>
      <main className="min-h-screen bg-[#050505] text-white font-sans selection:bg-red-500/30 pb-24 md:pb-20 overflow-hidden relative">
        
        {/* 🚀 HERO SECTION IMERSIVA COM MOSAICO (MAIS VISÍVEL E COMPACTA) */}
        <section className="relative w-full pt-16 pb-12 md:pt-24 md:pb-16 overflow-hidden border-b border-white/5 bg-black">
          
          {/* Fundo Mosaico Tecnológico */}
          <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none overflow-hidden">
            
            {/* Grid Inclinado (Opacidade ajustada para deixar as fotos visíveis sem poluir) */}
            <div className="absolute w-[150vw] md:w-[120vw] h-[150vh] transform -rotate-12 opacity-[0.4] md:opacity-[0.5] grid grid-cols-4 md:grid-cols-6 gap-2 md:gap-3 scale-110 z-0">
              {[...Array(24)].map((_, i) => (
                <div key={i} className="w-full h-32 md:h-48 bg-[#0a0a0e] rounded-lg overflow-hidden">
                  <img 
                    src={bgPhotos[i % bgPhotos.length]} 
                    className="w-full h-full object-cover grayscale-[20%]" 
                    alt="" 
                  />
                </div>
              ))}
            </div>

            {/* Overlays Suaves (Camadas extras de preto para o texto brilhar) */}
            <div className="absolute inset-0 bg-[#050505]/50 z-10"></div>
            <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/30 to-[#050505] z-10"></div>
            <div className="absolute inset-0 bg-gradient-to-r from-[#050505] via-transparent to-[#050505] z-10"></div>
            
            {/* Ponto de luz vermelho da iTatame (Usando red-900 para um vermelho escuro e sofisticado) */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-red-900/40 blur-[150px] rounded-full z-20"></div>
          </div>

          <div className="relative z-30 max-w-4xl mx-auto px-4 md:px-6 flex flex-col items-center text-center">
            
            <span className="inline-flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 text-red-400 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.2em] mb-4 shadow-[0_0_20px_rgba(239,68,68,0.15)]">
              <Camera size={12} /> Galeria Oficial de Eventos
            </span>

            {/* Fonte Reduzida e Container mais enxuto */}
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black uppercase tracking-tight leading-[1.1] drop-shadow-2xl mb-4">
              Encontre suas fotos.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-red-600 drop-shadow-md">Reviva suas conquistas.</span>
            </h1>

            <p className="text-zinc-300 text-xs font-medium max-w-xl mx-auto leading-relaxed mb-8 px-2 drop-shadow-md">
              Pesquise pelo seu evento ou encontre rapidamente todas as suas fotos usando o nosso algoritmo de reconhecimento facial.
            </p>

            {/* 🔍 BARRA DE PESQUISA (GLASSMORPHISM COMPACTO) */}
            <div className="w-full max-w-2xl bg-black/60 backdrop-blur-xl border border-white/15 p-2 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex flex-col md:flex-row gap-2">
              <div className="flex-1 flex items-center bg-black/50 border border-white/5 rounded-xl px-4 py-1 h-12 md:h-14 focus-within:border-red-500/50 transition-colors">
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
              <BuscaFacial />
            </div>

          </div>
        </section>

        {/* 🏆 EVENTOS RECENTES (GRID COMPACTO) */}
        <section className="relative z-20 max-w-7xl mx-auto px-4 md:px-6 py-12 md:py-16">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 mb-6 md:mb-8">
            <div>
              <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight flex items-center gap-2">
                <CalendarDays className="text-red-500" size={20} /> Coberturas Recentes
              </h2>
              <p className="text-[9px] md:text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Últimas galerias publicadas pelos nossos fotógrafos</p>
            </div>
            {eventosFiltrados.length > 0 && (
               <Link href="/fotos/eventos" className="hidden md:flex text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-white items-center gap-1 transition-colors bg-white/5 px-4 py-2 rounded-xl border border-white/5">
                 Ver todos eventos <ArrowRight size={12} />
               </Link>
            )}
          </div>

          {carregando ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
               {[1, 2, 3, 4].map(i => (
                 <div key={i} className="h-[160px] md:h-[200px] bg-white/5 rounded-2xl animate-pulse border border-white/5"></div>
               ))}
            </div>
          ) : eventosFiltrados.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] py-20 text-center flex flex-col items-center">
              <Search size={32} className="text-zinc-700 mb-4" />
              <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">Nenhuma galeria encontrada.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
              {eventosFiltrados.map((evento) => (
                <Link key={evento.id} href={`/fotos/evento/${evento.id}`} className="group relative flex flex-col h-[180px] md:h-[220px] rounded-2xl overflow-hidden bg-[#111] border border-white/5 hover:border-red-500/40 transition-all duration-300 shadow-lg hover:shadow-red-900/10">
                  
                  <div className="absolute inset-0 bg-black z-0">
                    <img 
                      src={evento.capa_url || "https://images.unsplash.com/photo-1599552375109-6bc228b3a728?q=80&w=800&auto=format&fit=crop"} 
                      alt={evento.nome} 
                      className="w-full h-full object-cover opacity-50 group-hover:scale-105 group-hover:opacity-40 transition-all duration-700" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent"></div>
                  </div>

                  <div className="relative z-10 flex flex-col h-full p-4 md:p-5">
                    <div className="flex justify-between items-start mb-auto">
                      <span className="bg-red-500/20 text-red-400 border border-red-500/30 text-[8px] md:text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md backdrop-blur-md">
                        Galeria Aberta
                      </span>
                    </div>

                    <div className="mt-auto transform transition-transform duration-300 md:group-hover:-translate-y-1">
                      <h3 className="text-xs md:text-sm font-black uppercase tracking-tight text-white mb-2 leading-tight group-hover:text-red-400 transition-colors line-clamp-2">
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
          <div className="relative rounded-3xl border border-white/5 bg-[#0a0a0e] overflow-hidden shadow-xl">
            <div className="absolute inset-0 bg-cyan-500/5 blur-[80px] pointer-events-none"></div>
            <div className="relative z-10 p-5 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
              
              <div className="flex-1 text-center md:text-left">
                <span className="inline-flex items-center gap-1.5 text-cyan-400 font-black text-[8px] md:text-[9px] uppercase tracking-[0.2em] mb-2">
                  <Camera size={12} /> Para Fotógrafos Parceiros
                </span>
                <h2 className="text-lg md:text-2xl font-black uppercase tracking-tighter leading-tight mb-2 text-white">
                  Venda suas fotos sem<br className="hidden md:block"/> pagar <span className="text-zinc-500">taxas abusivas.</span>
                </h2>
                <p className="text-zinc-400 text-[10px] md:text-[11px] font-medium leading-relaxed max-w-sm mx-auto md:mx-0">
                  Upload ilimitado via Cloudflare R2, proteção anti-print automática, pesquisa por IA e recebimento instantâneo via Pix.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto shrink-0">
                <Link href="/fotos/login?perfil=fotografo&next=/fotos/fotografo/dashboard" className="flex items-center justify-center bg-white/5 hover:bg-white/10 text-white border border-white/10 px-6 h-11 md:h-12 rounded-xl text-[9px] font-black uppercase tracking-widest transition-colors">
                  Painel do Fotógrafo
                </Link>
                <Link href="/fotos/fotografo" className="flex items-center justify-center bg-cyan-500 hover:bg-cyan-400 text-black px-6 h-11 md:h-12 rounded-xl text-[9px] font-black uppercase tracking-widest transition-colors shadow-[0_0_15px_rgba(6,182,212,0.2)]">
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
            <Link href="/fotos" className="flex flex-col items-center justify-center w-1/5 text-red-500">
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
