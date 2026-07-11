"use client";

import Link from "next/link";
import { useState, useMemo, useEffect } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import FotosShell from "../../_components/FotosShell";
import { 
  MapPin, 
  Share2, 
  Search, 
  CalendarDays, 
  ChevronRight, 
  Building2, 
  CheckCircle2,
  Image as ImageIcon,
  Loader2
} from "lucide-react";

export default function PerfilOrganizacaoPage() {
  const params = useParams<{ slug: string }>();
  const [busca, setBusca] = useState("");
  const [linkCopiado, setLinkCopiado] = useState(false);
  
  // 🔥 Estados Reais do Banco
  const [organizador, setOrganizador] = useState<any>(null);
  const [eventos, setEventos] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregarDados() {
      setCarregando(true);
      
      // 1. Buscar o organizador pelo Slug
      const { data: orgData, error: orgError } = await supabase
        .from("foto_organizadores")
        .select("*")
        .eq("slug", params.slug)
        .maybeSingle();

      if (!orgData || orgError) {
        setCarregando(false);
        return;
      }
      setOrganizador(orgData);

      // 2. Buscar Eventos deste Organizador
      const { data: evtsData } = await supabase
        .from("foto_eventos")
        .select("id, nome, data_evento, local, cidade, estado, capa_url")
        .eq("organizador_user_id", orgData.id)
        .eq("status", "publicado")
        .order("data_evento", { ascending: false });

      if (evtsData) {
        // 3. Buscar a quantidade de fotos de cada evento para exibir no Card
        const eventosComCount = await Promise.all(
          evtsData.map(async (evt) => {
            const { count } = await supabase
              .from("foto_arquivos")
              .select("*", { count: "exact", head: true })
              .eq("evento_id", evt.id)
              .eq("status", "publicada");
              
            return { ...evt, qtd_fotos: count || 0 };
          })
        );
        setEventos(eventosComCount);
      }
      
      setCarregando(false);
    }

    carregarDados();
  }, [params.slug]);

  // Filtro de eventos pela busca
  const eventosFiltrados = useMemo(() => {
    const termo = busca.toLowerCase().trim();
    if (!termo) return eventos;
    return eventos.filter(evt => evt.nome.toLowerCase().includes(termo) || (evt.cidade && evt.cidade.toLowerCase().includes(termo)));
  }, [busca, eventos]);

  const formatarData = (dataStr?: string) => {
    if (!dataStr) return "";
    const [ano, mes, dia] = dataStr.split("-");
    return `${dia}/${mes}/${ano}`;
  };

  const handleCompartilhar = () => {
    navigator.clipboard.writeText(window.location.href);
    setLinkCopiado(true);
    setTimeout(() => setLinkCopiado(false), 3000);
  };

  if (carregando) {
    return (
      <FotosShell>
         <main className="min-h-screen bg-[#050505] flex items-center justify-center flex-col gap-4">
            <Loader2 size={40} className="text-amber-500 animate-spin" />
            <p className="text-xs font-black uppercase tracking-widest text-zinc-500">Carregando Perfil...</p>
         </main>
      </FotosShell>
    );
  }

  if (!organizador) {
    return (
      <FotosShell>
         <main className="min-h-screen bg-[#050505] flex items-center justify-center flex-col gap-4">
            <Building2 size={40} className="text-zinc-700" />
            <p className="text-sm font-black uppercase tracking-widest text-zinc-500">Organizador não encontrado</p>
            <Link href="/fotos" className="mt-4 bg-amber-500 text-black px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer">Voltar aos Eventos</Link>
         </main>
      </FotosShell>
    );
  }

  return (
    <FotosShell>
      <main className="min-h-screen bg-[#050505] text-white font-sans pb-24">
        
        {/* 🔥 BANNER DO ORGANIZADOR COM TRATAMENTO DE ERRO (LOREMFLICKR) */}
        <section className="relative w-full h-[200px] md:h-[320px] bg-zinc-900 overflow-hidden border-b border-white/5">
          <div className="absolute inset-0">
            <img 
              src={organizador.capa_url || "https://loremflickr.com/1920/1080/jiujitsu,championship?lock=88"} 
              alt={`Capa de ${organizador.nome}`} 
              className="w-full h-full object-cover opacity-50"
              onError={(e) => { e.currentTarget.src = "https://loremflickr.com/1920/1080/jiujitsu,championship?lock=88" }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/60 to-transparent"></div>
          </div>
        </section>

        {/* 🔥 BLOCO DO PERFIL ARRASTADO MAIS PARA CIMA */}
        <section className="max-w-7xl mx-auto px-4 md:px-8 relative z-10 -mt-28 md:-mt-36">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            
            <div className="flex flex-col md:flex-row items-center md:items-end gap-5 text-center md:text-left">
              
              {/* 🔥 AVATAR: SE NÃO TIVER FOTO NO BANCO, MOSTRA A SIGLA "VB" */}
              <div className="w-36 h-36 md:w-44 md:h-44 rounded-full bg-[#111] border-[6px] border-[#050505] flex items-center justify-center overflow-hidden shadow-2xl shrink-0 relative group cursor-pointer">
                {organizador.avatar_url ? (
                  <img 
                    src={organizador.avatar_url} 
                    alt="Logo Organizador" 
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                    onError={(e) => { e.currentTarget.src = "https://loremflickr.com/400/400/jiujitsu,fighter?lock=20" }}
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-amber-500 to-red-600 flex items-center justify-center group-hover:scale-105 transition-transform duration-500">
                    <span className="text-5xl md:text-6xl font-black text-white tracking-tighter shadow-sm">{organizador.sigla || organizador.nome.substring(0, 2).toUpperCase()}</span>
                  </div>
                )}
              </div>
              
              <div className="mb-2 md:mb-4">
                <div className="flex items-center justify-center md:justify-start gap-2 mb-1">
                   <Building2 size={16} className="text-amber-500" />
                   <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-500">Organizador Verificado</p>
                </div>
                <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tight text-white drop-shadow-lg">{organizador.nome}</h1>
                <p className="text-xs md:text-sm text-zinc-300 mt-2 flex items-center justify-center md:justify-start gap-1.5 font-medium drop-shadow-md">
                  <MapPin size={14} className="text-red-500" /> {organizador.localizacao || "Brasil"}
                </p>
              </div>
            </div>

            <div className="flex justify-center md:justify-end mb-2 md:mb-4">
              <button 
                onClick={handleCompartilhar}
                className={`flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer shadow-lg ${
                  linkCopiado 
                    ? "bg-emerald-500 text-black shadow-[0_0_20px_rgba(16,185,129,0.3)]" 
                    : "bg-white/10 text-white hover:bg-white/20 border border-white/5 backdrop-blur-md"
                }`}
              >
                {linkCopiado ? <CheckCircle2 size={16} /> : <Share2 size={16} />}
                {linkCopiado ? "Link Copiado!" : "Compartilhar Perfil"}
              </button>
            </div>

          </div>
        </section>

        {/* LISTAGEM DE EVENTOS */}
        <div className="max-w-7xl mx-auto px-4 md:px-8 mt-10 md:mt-12">
          <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent mb-8"></div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-10">
            <div>
              <h2 className="text-lg md:text-xl font-black uppercase tracking-tight text-white flex items-center gap-2">
                Eventos Publicados <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full text-zinc-400 ml-2">{eventos.length}</span>
              </h2>
            </div>

            <div className="w-full md:w-[380px] relative group">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <Search size={16} className="text-zinc-500 group-focus-within:text-amber-500 transition-colors" />
              </div>
              <input 
                type="text" 
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar evento ou cidade..." 
                className="w-full bg-[#0a0a0e] border border-white/10 rounded-2xl py-3.5 pl-11 pr-4 text-xs font-medium text-white outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all placeholder:text-zinc-600"
              />
            </div>
          </div>

          {eventosFiltrados.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center bg-[#0a0a0e] border border-white/5 border-dashed rounded-3xl">
              <Search size={32} className="text-zinc-700 mb-4" />
              <p className="text-sm font-bold text-zinc-500 uppercase tracking-widest">Nenhum evento encontrado.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
              {eventosFiltrados.map((evt) => (
                <Link 
                  href={`/fotos/evento/${evt.id}`} 
                  key={evt.id}
                  className="group flex flex-col bg-[#0a0a0e] border border-white/5 rounded-3xl overflow-hidden hover:border-amber-500/30 transition-all duration-500 cursor-pointer shadow-lg hover:shadow-[0_10px_40px_rgba(245,158,11,0.08)]"
                >
                  <div className="relative h-48 md:h-52 overflow-hidden bg-zinc-900">
                    <img 
                      src={evt.capa_url || "https://images.pexels.com/photos/16335196/pexels-photo-16335196.jpeg"} 
                      alt={evt.nome} 
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-80 group-hover:opacity-100"
                      onError={(e) => { e.currentTarget.src = "https://images.pexels.com/photos/16335196/pexels-photo-16335196.jpeg" }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0e] via-[#0a0a0e]/20 to-transparent"></div>
                    
                    <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md border border-white/10 px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-sm">
                      <ImageIcon size={12} className="text-zinc-400" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-white">{evt.qtd_fotos} fotos</span>
                    </div>
                  </div>

                  <div className="p-5 flex flex-col flex-1 relative">
                    <h3 className="text-sm font-black uppercase tracking-tight text-white mb-4 line-clamp-2 leading-snug group-hover:text-amber-400 transition-colors">
                      {evt.nome}
                    </h3>
                    
                    <div className="mt-auto space-y-2.5 mb-6">
                      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                        <CalendarDays size={14} className="text-zinc-600 shrink-0" /> {formatarData(evt.data_evento)}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                        <MapPin size={14} className="text-zinc-600 shrink-0" /> <span className="truncate">{[evt.local, evt.cidade, evt.estado].filter(Boolean).join(" - ")}</span>
                      </div>
                    </div>

                    <div className="mt-auto pt-4 border-t border-white/5 flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-widest text-amber-500 group-hover:text-amber-400 transition-colors">Ver Galeria Oficial</span>
                      <div className="w-8 h-8 rounded-full bg-white/5 group-hover:bg-amber-500 text-zinc-500 group-hover:text-black flex items-center justify-center transition-colors">
                        <ChevronRight size={16} />
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

        </div>
      </main>
    </FotosShell>
  );
}