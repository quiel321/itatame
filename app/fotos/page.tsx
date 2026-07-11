"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { FotoEvento } from "@/app/lib/fotos";
import FotosShell from "./_components/FotosShell";
import { Camera, Search, ScanFace, CalendarDays, MapPin, ArrowRight, ShieldCheck, Zap, ShoppingCart } from "lucide-react";

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

// Fotos de Artes Marciais/Combate garantidas (Servidor sem bloqueio de Localhost)
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
      <main className="min-h-screen bg-[#050505] text-white font-sans selection:bg-red-500/30 pb-20 overflow-hidden">
        
        {/* 🚀 HERO SECTION IMERSIVA COM MOSAICO VISÍVEL */}
        <section className="relative w-full pt-20 pb-16 md:pt-32 md:pb-24 overflow-hidden border-b border-white/5 bg-black">
          
          {/* Fundo Mosaico Tecnológico */}
          <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none overflow-hidden">
            
            {/* Grid Inclinado (Agora na camada base z-0 com opacidade realçada) */}
            <div className="absolute w-[150vw] md:w-[120vw] h-[150vh] transform -rotate-12 opacity-[0.95] grid grid-cols-4 md:grid-cols-6 gap-2 md:gap-3 scale-110 z-0">
              {[...Array(24)].map((_, i) => (
                <div key={i} className="w-full h-32 md:h-48 bg-[#0a0a0e] rounded-lg overflow-hidden">
                  <img 
                    src={bgPhotos[i % bgPhotos.length]} 
                    className="w-full h-full object-cover" 
                    alt="" 
                  />
                </div>
              ))}
            </div>

            {/* Overlays Suaves (Apenas o suficiente para o texto branco dar contraste) */}
            <div className="absolute inset-0 bg-[#050505]/40 z-10"></div>
            <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/10 to-[#050505] z-10"></div>
            <div className="absolute inset-0 bg-gradient-to-r from-[#050505] via-transparent to-[#050505] z-10"></div>
            
            {/* Ponto de luz vermelho da iTatame */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-red-600/25 blur-[120px] rounded-full z-20"></div>
          </div>

          <div className="relative z-30 max-w-4xl mx-auto px-4 md:px-6 flex flex-col items-center text-center">
            
            <span className="inline-flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 text-red-400 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.2em] mb-4 shadow-[0_0_20px_rgba(239,68,68,0.15)]">
              <Camera size={12} /> Galeria Oficial de Eventos
            </span>

            <h1 className="text-2xl sm:text-3xl md:text-5xl font-black uppercase tracking-tight leading-[1.1] drop-shadow-2xl mb-4">
              Encontre e compre suas fotos.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-red-700 drop-shadow-md">Reviva suas conquistas.</span>
            </h1>

            <p className="text-zinc-300 text-[11px] md:text-sm font-medium max-w-xl mx-auto leading-relaxed mb-8 px-2 drop-shadow-md">
              Pesquise pelo seu evento ou encontre rapidamente todas as suas fotos usando o nosso algoritmo de reconhecimento facial.
            </p>

            {/* 🔍 BARRA DE PESQUISA (GLASSMORPHISM COMPACTO) */}
            <div className="w-full max-w-2xl bg-black/60 backdrop-blur-xl border border-white/15 p-2 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex flex-col md:flex-row gap-2">
              <div className="flex-1 flex items-center bg-black/50 border border-white/5 rounded-xl px-4 py-1 h-11 md:h-12 focus-within:border-red-500/50 transition-colors">
                <Search size={14} className="text-zinc-400 mr-2 shrink-0" />
                <input 
                  type="text" 
                  placeholder="Nome do evento, cidade ou local..." 
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="w-full bg-transparent border-none text-[11px] md:text-xs text-white outline-none placeholder:text-zinc-500 font-medium"
                />
              </div>
              <button 
                onClick={() => alert('Módulo de Inteligência Artificial em treinamento! Em breve.')}
                className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white px-5 h-11 md:h-12 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(239,68,68,0.3)] shrink-0"
              >
                <ScanFace size={16} /> Buscar por Face
              </button>
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
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Últimas galerias publicadas pelos nossos fotógrafos</p>
            </div>
            {eventosFiltrados.length > 0 && (
               <Link href="/fotos/eventos" className="hidden md:flex text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-white items-center gap-1 transition-colors bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
                 Ver todos <ArrowRight size={12} />
               </Link>
            )}
          </div>

          {carregando ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
               {[1, 2, 3, 4].map(i => (
                 <div key={i} className="h-[140px] md:h-[180px] bg-white/5 rounded-xl animate-pulse border border-white/5"></div>
               ))}
            </div>
          ) : eventosFiltrados.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] py-16 text-center flex flex-col items-center">
              <Search size={28} className="text-zinc-700 mb-3" />
              <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">Nenhuma galeria encontrada.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
              {eventosFiltrados.map((evento) => (
                <Link key={evento.id} href={`/fotos/evento/${evento.id}`} className="group relative flex flex-col h-[160px] md:h-[200px] rounded-xl overflow-hidden bg-[#111] border border-white/5 hover:border-red-500/40 transition-all duration-300 shadow-lg hover:shadow-red-900/10">
                  
                  <div className="absolute inset-0 bg-black z-0">
                    <img 
                      src={evento.capa_url || "https://images.unsplash.com/photo-1599552375109-6bc228b3a728?q=80&w=800&auto=format&fit=crop"} 
                      alt={evento.nome} 
                      className="w-full h-full object-cover opacity-50 group-hover:scale-105 group-hover:opacity-40 transition-all duration-700" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent"></div>
                  </div>

                  <div className="relative z-10 flex flex-col h-full p-3 md:p-4">
                    <div className="flex justify-between items-start mb-auto">
                      <span className="bg-red-500/20 text-red-400 border border-red-500/30 text-[7px] md:text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded backdrop-blur-md">
                        Galeria Aberta
                      </span>
                    </div>

                    <div className="mt-auto transform transition-transform duration-300 md:group-hover:-translate-y-1">
                      <h3 className="text-[11px] md:text-sm font-black uppercase tracking-tight text-white mb-1.5 md:mb-2 leading-tight group-hover:text-red-400 transition-colors line-clamp-2">
                        {evento.nome}
                      </h3>
                      <div className="flex flex-col gap-1 md:gap-1.5 text-[8px] md:text-[9px] text-zinc-400 font-bold uppercase tracking-widest">
                        {evento.data_evento && <span className="flex items-center gap-1.5"><CalendarDays size={10} className="text-zinc-500"/> {formatarData(evento.data_evento)}</span>}
                        {evento.cidade && <span className="flex items-center gap-1.5 truncate"><MapPin size={10} className="text-zinc-500"/> {evento.cidade} {evento.estado ? `- ${evento.estado}` : ""}</span>}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* 📸 ÁREA DO FOTÓGRAFO (DIRETA E COMPACTA) */}
        <section className="relative mx-4 md:mx-6 mb-8 rounded-2xl border border-white/5 bg-[#0a0a0e] overflow-hidden">
          <div className="absolute inset-0 bg-cyan-500/5 blur-[80px] pointer-events-none"></div>
          <div className="relative z-10 p-5 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 max-w-6xl mx-auto">
            
            <div className="flex-1 text-center md:text-left">
              <span className="inline-flex items-center gap-1.5 text-cyan-400 font-black text-[8px] md:text-[9px] uppercase tracking-[0.2em] mb-2">
                <Camera size={12} /> Para Fotógrafos Parceiros
              </span>
              <h2 className="text-lg md:text-2xl font-black uppercase tracking-tighter leading-tight mb-2">
                Venda suas fotos sem<br className="hidden md:block"/> pagar <span className="text-zinc-500">taxas abusivas.</span>
              </h2>
              <p className="text-zinc-400 text-[10px] md:text-[11px] font-medium leading-relaxed max-w-sm mx-auto md:mx-0">
                Upload ilimitado via Cloudflare R2, proteção anti-print automática, pesquisa por IA e recebimento via Pix.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto shrink-0">
              <Link href="/fotos/fotografo/login" className="flex items-center justify-center bg-white/5 hover:bg-white/10 text-white border border-white/10 px-5 h-10 md:h-11 rounded-xl text-[9px] font-black uppercase tracking-widest transition-colors">
                Painel do Fotógrafo
              </Link>
              <Link href="/fotos/fotografo/" className="flex items-center justify-center bg-cyan-500 hover:bg-cyan-400 text-black px-5 h-10 md:h-11 rounded-xl text-[9px] font-black uppercase tracking-widest transition-colors shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                Começar a vender
              </Link>
            </div>

          </div>
        </section>

      </main>
    </FotosShell>
  );
}