"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import { FotoAlbum, FotoArquivo, formatarPrecoFotos } from "@/app/lib/fotos";
import FotosShell from "../../_components/FotosShell";
import BuscaFacial from "../../_components/BuscaFacial";
import { Camera, CalendarDays, CheckCircle2, ChevronLeft, Filter, Image as ImageIcon, MapPin, ScanFace, Search, ShieldCheck, ShoppingCart, X, Building2, Percent } from "lucide-react";

const CARRINHO_FOTOS_KEY = "carrinho_fotos";

function fotoPreviewSrc(foto: FotoArquivo) {
  return `/api/fotos/arquivo/${foto.id}?tipo=preview`;
}

export default function FotosEventoPage() {
  const params = useParams<{ id: string }>();
  const eventoId = params.id;
  const [evento, setEvento] = useState<any>(null); 
  const [albuns, setAlbuns] = useState<FotoAlbum[]>([]);
  const [fotos, setFotos] = useState<FotoArquivo[]>([]);
  const [albumAtivo, setAlbumAtivo] = useState("todos");
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);
  
  const [carrinho, setCarrinho] = useState<string[]>([]);
  const [carrinhoCarregado, setCarrinhoCarregado] = useState(false);
  const [fotoSelecionada, setFotoSelecionada] = useState<FotoArquivo | null>(null);
  const [fotoOrigemIa, setFotoOrigemIa] = useState(false);
  const temporizadorProtecaoRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const desativarProtecao = () => {
      document.documentElement.classList.remove("fotos-protecao-instantanea");
    };

    const agendarDesativacao = (duracao: number) => {
      if (temporizadorProtecaoRef.current) clearTimeout(temporizadorProtecaoRef.current);
      temporizadorProtecaoRef.current = setTimeout(desativarProtecao, duracao);
    };

    const ativarProtecao = (duracao = 2500) => {
      document.documentElement.classList.add("fotos-protecao-instantanea");
      agendarDesativacao(duracao);
    };

    const teclaPreventiva = (e: KeyboardEvent) =>
      e.key === "Shift" ||
      e.key === "Meta" ||
      e.key === "OS" ||
      e.key === "Super" ||
      e.key === "PrintScreen" ||
      e.code === "ShiftLeft" ||
      e.code === "ShiftRight" ||
      e.code === "MetaLeft" ||
      e.code === "MetaRight" ||
      e.code === "PrintScreen";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!teclaPreventiva(e)) return;
      if (e.key === "PrintScreen" || e.code === "PrintScreen") e.preventDefault();
      ativarProtecao(2500);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (teclaPreventiva(e)) agendarDesativacao(350);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") ativarProtecao(2500);
      else agendarDesativacao(350);
    };
    const handleBeforePrint = () => ativarProtecao(10000);
    const handleAfterPrint = () => agendarDesativacao(350);
    const handlePageHide = () => ativarProtecao(2500);
    const protegerInteracao = (e: Event) => {
      const alvo = e.target as HTMLElement | null;
      if (alvo?.closest("[data-foto-protegida]")) e.preventDefault();
    };

    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("keyup", handleKeyUp, true);
    window.addEventListener("pagehide", handlePageHide, true);
    window.addEventListener("beforeprint", handleBeforePrint);
    window.addEventListener("afterprint", handleAfterPrint);
    document.addEventListener("visibilitychange", handleVisibilityChange, true);
    document.addEventListener("contextmenu", protegerInteracao);
    document.addEventListener("dragstart", protegerInteracao);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("keyup", handleKeyUp, true);
      window.removeEventListener("pagehide", handlePageHide, true);
      window.removeEventListener("beforeprint", handleBeforePrint);
      window.removeEventListener("afterprint", handleAfterPrint);
      document.removeEventListener("visibilitychange", handleVisibilityChange, true);
      document.removeEventListener("contextmenu", protegerInteracao);
      document.removeEventListener("dragstart", protegerInteracao);
      if (temporizadorProtecaoRef.current) clearTimeout(temporizadorProtecaoRef.current);
      document.documentElement.classList.remove("fotos-protecao-instantanea");
    };
  }, []);

  useEffect(() => {
    try {
      const idsSalvos = JSON.parse(localStorage.getItem(CARRINHO_FOTOS_KEY) || "[]");
      setCarrinho(Array.isArray(idsSalvos) ? idsSalvos.map(String) : []);
    } catch {
      setCarrinho([]);
    } finally {
      setCarrinhoCarregado(true);
    }
  }, []);

  useEffect(() => {
    if (!carrinhoCarregado) return;
    localStorage.setItem(CARRINHO_FOTOS_KEY, JSON.stringify(carrinho));
    window.dispatchEvent(new CustomEvent("carrinho-fotos-atualizado", { detail: carrinho }));
  }, [carrinho, carrinhoCarregado]);

  useEffect(() => {
    async function carregar() {
      if (!eventoId) return;
      setCarregando(true);

      // 1. Busca os dados base do evento (🔥 ADICIONADO: 'created_by' no select)
      const [{ data: eventoData }, { data: albunsData }, { data: fotosData }] = await Promise.all([
        supabase.from("foto_eventos").select("id, nome, slug, local, cidade, estado, data_evento, capa_url, status, vendas_ate, desconto_combo_qtd, desconto_combo_percentual, organizador_user_id, created_by").eq("id", eventoId).maybeSingle(),
        supabase.from("foto_albuns").select("id, evento_id, fotografo_id, titulo, descricao, capa_url, status").eq("evento_id", eventoId).eq("status", "publicado").order("ordem", { ascending: true }),
        supabase.from("foto_arquivos").select("id, evento_id, album_id, fotografo_id, titulo, r2_original_key, r2_preview_key, r2_thumb_key, preview_url, thumb_url, preco_centavos, status, fotografo_dados:fotografos!fotografo_id(nome)").eq("evento_id", eventoId).eq("status", "publicada").order("created_at", { ascending: false }),
      ]);

      // 2. 🔥 INTELIGÊNCIA DO BANNER CORRIGIDA
      let autorNome = "Organizador";
      let autorSlug = "";
      let tipoAutor = "organizador";

      if (eventoData?.organizador_user_id) {
         // Se tem organizador_user_id, é uma galeria oficial de Organizador
         const { data: orgData } = await supabase.from("foto_organizadores").select("nome, slug").eq("id", eventoData.organizador_user_id).maybeSingle();
         if (orgData) {
            autorNome = orgData.nome || "Organizador";
            autorSlug = orgData.slug || "";
            tipoAutor = "organizador";
         }
      } else if (eventoData?.created_by) {
         // Se não tem organizador, mas tem created_by, é Fotógrafo Freelancer
         const { data: fotoData } = await supabase.from("fotografos").select("nome").eq("user_id", eventoData.created_by).maybeSingle();
         if (fotoData) {
            autorNome = fotoData.nome || "Fotógrafo Parceiro";
            tipoAutor = "fotografo";
         }
      }

      const eventoCompleto = {
        ...(eventoData || {}),
        autor_nome: autorNome,
        autor_slug: autorSlug,
        tipo_autor: tipoAutor
      };

      setEvento(eventoCompleto);
      setAlbuns((albunsData || []) as FotoAlbum[]);
      setFotos((fotosData || []) as FotoArquivo[]);
      setCarregando(false);
    }

    carregar();
  }, [eventoId]);

  useEffect(() => {
    if (fotos.length === 0) return;
    const parametros = new URLSearchParams(window.location.search);
    const fotoId = parametros.get("foto");
    if (!fotoId) return;

    const fotoEncontrada = fotos.find((foto) => String(foto.id) === fotoId);
    if (!fotoEncontrada) return;

    const frame = window.requestAnimationFrame(() => {
      setFotoSelecionada(fotoEncontrada);
      setFotoOrigemIa(parametros.get("origem") === "ia");
    });
    return () => window.cancelAnimationFrame(frame);
  }, [fotos]);

  const fotosFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return fotos.filter((foto) => {
      const bateAlbum = albumAtivo === "todos" || foto.album_id === albumAtivo;
      const texto = [foto.titulo, foto.id].filter(Boolean).join(" ").toLowerCase();
      const bateBusca = !termo || texto.includes(termo);
      return bateAlbum && bateBusca;
    });
  }, [fotos, albumAtivo, busca]);

  const toggleCarrinho = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation(); 
    setCarrinho(prev => prev.includes(id) ? prev.filter(fotoId => fotoId !== id) : [...prev, id]);
  };

  const fecharFotoSelecionada = () => {
    if (temporizadorProtecaoRef.current) clearTimeout(temporizadorProtecaoRef.current);
    document.documentElement.classList.remove("fotos-protecao-instantanea");
    setFotoSelecionada(null);
    setFotoOrigemIa(false);

    const url = new URL(window.location.href);
    if (url.searchParams.has("foto")) {
      url.searchParams.delete("foto");
      url.searchParams.delete("origem");
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }
  };

  const valorTotalCarrinho = carrinho.reduce((total, fotoId) => {
    const foto = fotos.find(f => String(f.id) === fotoId);
    return total + (foto ? foto.preco_centavos : 0);
  }, 0);

  const formatarData = (dataStr?: string | null) => {
    if (!dataStr) return "";
    const [ano, mes, dia] = dataStr.slice(0, 10).split("-");
    return `${dia}/${mes}/${ano}`;
  };

  return (
    <FotosShell>
      <main data-foto-protegida className="min-h-screen bg-[#020202] text-white font-sans pb-28 relative print:hidden">
        
        <div className="max-w-screen-2xl mx-auto px-2 md:px-4">
          
          <section className="mt-4 mb-4 overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0e] shadow-2xl relative">
            <div className="relative min-h-[220px] md:min-h-[260px] px-4 py-6 md:px-8 md:py-8 flex flex-col">
              <div className="absolute inset-0 opacity-40">
                <img
                  src={evento?.capa_url || "https://images.pexels.com/photos/16335196/pexels-photo-16335196.jpeg?auto=compress&cs=tinysrgb&w=1920"}
                  alt={evento?.nome || "Galeria de fotos"}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-black/30" />
              </div>

              <div className="relative z-10 max-w-4xl flex flex-col h-full justify-center">
                
                <Link href="/fotos" className="inline-flex cursor-pointer items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 hover:text-white transition-colors mb-5 w-fit">
                  <ChevronLeft size={14} /> Voltar aos eventos
                </Link>
                
                {/* 🔥 IDENTIFICAÇÃO DO AUTOR DA GALERIA */}
                <div className="mb-3">
                   {evento?.tipo_autor === "organizador" && evento?.autor_slug ? (
                       <Link href={`/fotos/organizador/${evento.autor_slug}`} className="inline-flex items-center gap-2.5 bg-white/10 hover:bg-white/20 border border-white/10 rounded-full pr-4 pl-1 py-1 backdrop-blur-md transition-all cursor-pointer group w-fit">
                          <div className="w-6 h-6 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center text-[9px] font-black text-white group-hover:scale-110 transition-transform">
                             <Building2 size={12} className="text-zinc-400 group-hover:text-white" />
                          </div>
                          <span className="text-[10px] font-bold text-zinc-300 group-hover:text-white uppercase tracking-widest">
                             Por: {evento.autor_nome}
                          </span>
                       </Link>
                   ) : (
                       <div className="inline-flex items-center gap-2.5 bg-cyan-500/10 border border-cyan-500/20 rounded-full pr-4 pl-1 py-1 backdrop-blur-md w-fit">
                          <div className="w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-[9px] font-black text-cyan-400">
                             <Camera size={12} />
                          </div>
                          <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest">
                             Por: {evento?.autor_nome}
                          </span>
                       </div>
                   )}
                </div>

                <h1 className="mt-1 max-w-3xl text-3xl font-black uppercase tracking-tight leading-none text-white md:text-5xl">
                  {evento?.nome || "Evento iTatame Fotos"}
                </h1>

                <div className="mt-5 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wider text-zinc-200">
                  {evento?.data_evento && (
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/50 backdrop-blur-md px-3 py-2">
                      <CalendarDays size={14} className="text-cyan-400" /> {formatarData(evento.data_evento)}
                    </span>
                  )}
                  {(evento?.cidade || evento?.local) && (
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/50 backdrop-blur-md px-3 py-2">
                      <MapPin size={14} className="text-red-500" /> {[evento.local, evento.cidade, evento.estado].filter(Boolean).join(" - ")}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/50 backdrop-blur-md px-3 py-2">
                    <ImageIcon size={14} className="text-zinc-400" /> {fotos.length} fotos · {albuns.length || 1} álbum
                  </span>
                </div>
              </div>
            </div>
          </section>
          
          <div className="sticky top-[60px] md:top-[80px] z-40 mb-6 bg-[#0a0a0e]/90 backdrop-blur-xl border border-white/10 p-2 md:p-3 rounded-2xl flex flex-col md:flex-row gap-3 shadow-2xl">
            
            <BuscaFacial
              eventoId={eventoId}
              triggerLabel="Pesquisa facial"
              triggerClassName="flex items-center justify-center gap-2.5 bg-black/50 hover:bg-black border border-white/5 rounded-xl px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.1em] text-white shrink-0 cursor-pointer transition-colors"
            />

            <div className="w-[1px] h-8 bg-white/5 hidden md:block self-center"></div>

            <div className="flex-1 flex items-center bg-black/60 border border-white/5 rounded-xl px-4 py-2.5 focus-within:border-cyan-500/40 transition-colors cursor-text">
              <Search size={16} className="text-zinc-500 mr-2 shrink-0" />
              <input 
                value={busca} 
                onChange={(e) => setBusca(e.target.value)} 
                placeholder="Buscar por nome do atleta, academia ou número..." 
                className="w-full bg-transparent border-none text-xs text-white outline-none placeholder:text-zinc-600 font-medium"
              />
            </div>

            <div className="flex gap-2 overflow-x-auto scrollbar-hide py-0.5 items-center">
              <div className="flex items-center gap-1.5 px-3 text-zinc-600 text-[9px] font-black uppercase tracking-widest shrink-0 border-r border-white/10 mr-1">
                <Filter size={14} /> Álbuns
              </div>
              <button 
                onClick={() => setAlbumAtivo("todos")} 
                className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all cursor-pointer shrink-0 ${albumAtivo === "todos" ? 'bg-cyan-500 text-black shadow-md shadow-cyan-900/30' : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'}`}
              >
                Todas ({fotos.length})
              </button>
              {albuns.map(album => (
                <button 
                  key={album.id}
                  onClick={() => setAlbumAtivo(album.id)}
                  className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all cursor-pointer shrink-0 ${albumAtivo === album.id ? 'bg-cyan-500 text-black shadow-md shadow-cyan-900/30' : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'}`}
                >
                  {album.titulo}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-6 rounded-3xl bg-gradient-to-r from-[#1a0505] via-red-950/20 to-[#0a0a0e] border border-red-500/20 p-5 md:p-6 flex flex-col md:flex-row items-center justify-between gap-5 shadow-lg shadow-red-900/10">
             <div className="flex items-center gap-4 text-center md:text-left">
                <div className="hidden sm:flex w-12 h-12 rounded-full bg-red-500/10 text-red-500 items-center justify-center shrink-0 border border-red-500/20">
                   <Percent size={24} />
                </div>
                <div>
                   <h3 className="text-lg md:text-xl font-black uppercase tracking-tight text-white mb-1">
                      Leve mais, <span className="text-red-500">Pague menos</span>
                   </h3>
                   <p className="text-[11px] text-zinc-400 font-medium uppercase tracking-widest">
                      Economize até 20% comprando pacotes no carrinho.
                   </p>
                </div>
             </div>
             <div className="flex gap-3 w-full md:w-auto">
                <div className="flex-1 md:flex-none bg-black/40 border border-white/5 rounded-2xl px-5 py-3 text-center">
                   <p className="text-xl font-black text-white">10<span className="text-xs text-zinc-500">%</span></p>
                   <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mt-1">2 fotos</p>
                </div>
                <div className="flex-1 md:flex-none bg-red-500/10 border border-red-500/30 rounded-2xl px-5 py-3 text-center shadow-[0_0_15px_rgba(239,68,68,0.1)]">
                   <p className="text-xl font-black text-red-400">20<span className="text-xs text-red-500/50">%</span></p>
                   <p className="text-[9px] font-black uppercase tracking-widest text-red-400 mt-1">3+ fotos</p>
                </div>
             </div>
          </div>

          {carregando ? (
            <div className="mt-12 flex flex-col items-center justify-center gap-4 opacity-50 py-20">
               <ImageIcon size={32} className="text-zinc-700 animate-pulse" />
               <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-600">Processando galeria...</p>
            </div>
          ) : fotosFiltradas.length === 0 ? (
            <div className="mt-8 rounded-3xl border border-dashed border-white/10 bg-white/[0.01] p-16 text-center flex flex-col items-center justify-center">
              <Search size={24} className="text-zinc-800 mb-4" />
              <p className="text-[11px] font-bold text-zinc-600 uppercase tracking-widest">Nenhuma foto encontrada para este filtro.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 xs:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 xl2:grid-cols-7 gap-2 md:gap-3">
              {fotosFiltradas.map((foto) => {
                const noCarrinho = carrinho.includes(String(foto.id));
                
                return (
                  <article 
                    key={foto.id} 
                    onClick={() => {
                      setFotoOrigemIa(false);
                      setFotoSelecionada(foto);
                    }}
                    className="group relative aspect-[4/5] rounded-2xl overflow-hidden bg-[#111] border border-white/5 shadow-md cursor-pointer transition-all duration-300 hover:shadow-cyan-900/20 hover:border-cyan-500/30"
                  >
                    
                    {foto.r2_thumb_key || foto.r2_preview_key ? (
                      <img
                        data-foto-protegida-imagem
                        src={fotoPreviewSrc(foto)} 
                        alt={foto.titulo || "Foto do evento"} 
                        className={`w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105 ${noCarrinho ? 'opacity-40 grayscale-[60%]' : 'opacity-90'}`} 
                        loading="lazy" 
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center px-4 text-center text-[9px] font-black uppercase tracking-[0.2em] text-zinc-700 bg-zinc-950">iTatame</div>
                    )}

                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.15] group-hover:opacity-[0.25] transition-opacity select-none z-10">
                      <span className="text-xl md:text-2xl font-black uppercase tracking-[0.3em] rotate-[-30deg]">
                        <span className="text-white drop-shadow-md">i</span><span className="text-red-500 drop-shadow-md">Tatame</span>
                      </span>
                    </div>

                    <div className="absolute left-1 md:left-2 top-0 bottom-0 flex items-center justify-center pointer-events-none select-none z-10 opacity-30">
                      <span className="text-white text-[7px] md:text-[8px] font-black uppercase tracking-[0.25em] -rotate-90 whitespace-nowrap drop-shadow-md">
                        Não tire print, valorize o fotógrafo
                      </span>
                    </div>

                    <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/95 via-black/40 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20"></div>

                    <div className="absolute top-2 left-2 pointer-events-none z-20 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                      <span className="bg-black/80 backdrop-blur-sm text-white text-[7px] font-bold uppercase tracking-widest px-2 py-1 rounded-md border border-white/10 shadow-sm">
                        REF: {foto.id.toString().substring(0, 5)}
                      </span>
                    </div>

                    <div className="absolute bottom-2 left-2 right-2 flex flex-col gap-1.5 z-30 md:opacity-0 md:group-hover:opacity-100 md:group-hover:translate-y-0 md:translate-y-2 transition-all duration-300">
                      <p className="line-clamp-1 text-[9px] font-bold uppercase tracking-tight text-white truncate hidden md:block px-1 mb-1">{foto.titulo || "Foto do evento"}</p>
                      
                      <div className="flex items-center justify-between gap-1.5 backdrop-blur-sm bg-black/60 rounded-xl p-1 border border-white/10 md:bg-white/95 md:text-black md:border-transparent">
                          <span className="text-[10px] md:text-[11px] font-black text-cyan-400 md:text-black md:pl-2 pr-1">{formatarPrecoFotos(foto.preco_centavos)}</span>
                          <button 
                            onClick={(e) => toggleCarrinho(String(foto.id), e)}
                            className={`cursor-pointer px-3 py-2 rounded-lg text-[8px] md:text-[9px] font-black uppercase tracking-widest transition-all ${noCarrinho ? 'bg-green-500 text-white' : 'bg-cyan-500 text-black hover:bg-cyan-400 md:bg-black/90 md:text-white md:hover:bg-black'}`}
                          >
                            {noCarrinho ? <CheckCircle2 size={12}/> : "Carrinho"}
                          </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {carrinho.length > 0 && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[95%] max-w-sm bg-[#16161e]/95 backdrop-blur-xl border border-cyan-500/30 p-2.5 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_30px_rgba(6,182,212,0.2)] flex items-center justify-between z-40 animate-in slide-in-from-bottom-10 fade-in duration-300">
              <div className="flex items-center gap-3 pl-2">
                <div className="w-10 h-10 bg-black/40 rounded-xl flex items-center justify-center border border-white/10 text-white shrink-0">
                  <ImageIcon size={18} />
                </div>
                <div>
                  <p className="text-white text-[9px] font-black uppercase tracking-widest">{carrinho.length} {carrinho.length === 1 ? 'Foto' : 'Fotos'}</p>
                  <p className="text-cyan-400 text-xs font-black mt-0.5">{formatarPrecoFotos(valorTotalCarrinho)}</p>
                </div>
              </div>
              <Link href="/fotos/carrinho" className="bg-red-600 hover:bg-red-500 text-white px-6 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer shadow-lg shadow-red-950/20 hover:scale-105">
                Finalizar compra
              </Link>
            </div>
          )}

        </div>

        {/* MODAL DE FOTO */}
        {fotoSelecionada && (
          <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-md flex items-center justify-center p-2 md:p-4 animate-in fade-in duration-300" onClick={fecharFotoSelecionada}>
            <div className="relative w-full max-w-7xl h-full flex flex-col md:flex-row gap-4 items-center justify-center" onClick={(e) => e.stopPropagation()}>
              
              <button onClick={fecharFotoSelecionada} className="absolute top-2 right-2 md:top-4 md:right-4 z-50 cursor-pointer text-white bg-black/60 hover:bg-black p-2.5 rounded-full backdrop-blur-sm border border-white/10 transition-colors" aria-label="Fechar foto">
                <X size={20} />
              </button>

              <div className="relative flex-1 h-[70vh] md:h-full w-full flex items-center justify-center overflow-hidden rounded-3xl bg-[#050505] border border-white/5 shadow-2xl">
                <img
                  data-foto-protegida-imagem
                  src={fotoPreviewSrc(fotoSelecionada)} 
                  alt={fotoSelecionada.titulo || "Foto do evento"} 
                  className="w-auto h-auto max-w-full max-h-full object-contain select-none pointer-events-none" 
                  loading="lazy" 
                />
                
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.15] select-none z-10">
                  <span className="text-4xl md:text-6xl font-black uppercase tracking-[0.3em] rotate-[-25deg]">
                    <span className="text-white drop-shadow-lg">i</span><span className="text-red-500 drop-shadow-lg">Tatame</span>
                  </span>
                </div>

                <div className="absolute left-2 md:left-6 top-0 bottom-0 flex items-center justify-center pointer-events-none select-none z-10 opacity-30">
                  <span className="text-white text-[10px] md:text-sm font-black uppercase tracking-[0.3em] -rotate-90 whitespace-nowrap drop-shadow-lg">
                    Não tire print, valorize o fotógrafo
                  </span>
                </div>
              </div>

              <div className="w-full md:w-[340px] shrink-0 bg-[#0a0a0e] border border-white/5 rounded-3xl p-5 md:p-6 flex flex-col gap-5 shadow-2xl">

                {fotoOrigemIa && (
                  <div className="flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-[9px] font-black uppercase tracking-widest text-emerald-300">
                    <ScanFace size={14} /> Encontrada pela busca facial
                  </div>
                )}
                
                <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-zinc-900 flex items-center justify-center text-zinc-500 border border-white/5 shrink-0 shadow-inner">
                        <ImageIcon size={20}/>
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-white text-sm font-black uppercase tracking-tight truncate">{fotoSelecionada.titulo || "Foto do evento"}</h3>
                        <p className="text-zinc-500 text-[9px] uppercase tracking-widest mt-0.5">REF: {fotoSelecionada.id.toString().substring(0, 8)}</p>
                    </div>
                </div>

                <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>

                <div className="flex flex-col gap-4">
                    
                    <div className="flex items-center gap-3 bg-white/[0.02] border border-white/5 rounded-2xl p-3 transition-colors hover:bg-white/[0.04]">
                        <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500 shrink-0 border border-red-500/20">
                            <Camera size={16} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest mb-0.5">Lentes por</p>
                            <p className="text-[11px] font-black text-white uppercase tracking-wider truncate">
                                {(fotoSelecionada as any).fotografo_dados?.nome || "Fotógrafo Parceiro"}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <span className="bg-white/5 text-zinc-400 text-[9px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-1.5">
                           <ShieldCheck size={12} className="text-emerald-500/70"/> Jiu-Jitsu
                        </span>
                        {evento && (
                           <span className="bg-white/5 text-zinc-400 text-[9px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-1.5">
                              <CalendarDays size={12} className="text-cyan-500/70"/> {formatarData(evento.data_evento)}
                           </span>
                        )}
                    </div>
                </div>
                
                <div className="mt-auto flex flex-col gap-4">
                  <div className="flex items-end justify-between bg-[#050505] p-4 rounded-2xl border border-white/5">
                      <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Valor da Foto</p>
                      <p className="text-3xl font-black text-cyan-400 tracking-tight leading-none pr-1">{formatarPrecoFotos(fotoSelecionada.preco_centavos)}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 w-full">
                    
                    {carrinho.includes(String(fotoSelecionada.id)) ? (
                       <button onClick={(e) => toggleCarrinho(String(fotoSelecionada.id), e)} className="w-full cursor-pointer py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                         <CheckCircle2 size={14}/> Na Sacola
                       </button>
                    ) : (
                      <button onClick={(e) => toggleCarrinho(String(fotoSelecionada.id), e)} className="w-full cursor-pointer py-3.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                        <ShoppingCart size={14}/> Adicionar
                      </button>
                    )}
                    
                    <Link 
                      href="/fotos/carrinho" 
                      onClick={(e) => {
                        if (!carrinho.includes(String(fotoSelecionada.id))) {
                          toggleCarrinho(String(fotoSelecionada.id));
                        }
                      }} 
                      className="w-full cursor-pointer py-3.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(239,68,68,0.2)] text-center"
                    >
                      Finalizar
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>

      <div className="fixed inset-0 z-[9999] hidden items-center justify-center bg-white p-10 text-center text-black print:flex">
        <div>
          <p className="text-2xl font-black uppercase">Impressão desativada</p>
          <p className="mt-3 text-sm">Adquira a foto para baixar o arquivo original autorizado.</p>
        </div>
      </div>
    </FotosShell>
  );
}
