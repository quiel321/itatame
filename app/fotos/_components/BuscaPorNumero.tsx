"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Hash, Loader2, Search, ShoppingCart, X } from "lucide-react";
import { BUSCA_NUMERO_MODALIDADES } from "@/app/lib/fotos-busca-numero";

type ResultadoNumero = {
  id: string;
  eventoId: string;
  titulo: string | null;
  precoCentavos: number;
  numerosDetectados: string[];
  evento: { id: string; nome: string; data_evento: string | null; cidade: string | null; estado: string | null } | null;
};

type BuscaPorNumeroProps = {
  eventoId?: string;
  triggerLabel?: string;
  triggerClassName?: string;
};

const CARRINHO_FOTOS_KEY = "carrinho_fotos";

export default function BuscaPorNumero({ eventoId, triggerLabel, triggerClassName }: BuscaPorNumeroProps) {
  const [aberto, setAberto] = useState(false);
  const [numero, setNumero] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState("");
  const [resultados, setResultados] = useState<ResultadoNumero[] | null>(null);
  const [fotosNoCarrinho, setFotosNoCarrinho] = useState<string[]>([]);

  useEffect(() => {
    if (!aberto) return;
    const overflowAnterior = document.body.style.overflow;
    const fechar = (event: KeyboardEvent) => event.key === "Escape" && setAberto(false);
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", fechar);
    return () => {
      document.body.style.overflow = overflowAnterior;
      window.removeEventListener("keydown", fechar);
    };
  }, [aberto]);

  function abrir() {
    try {
      const salvas = JSON.parse(localStorage.getItem(CARRINHO_FOTOS_KEY) || "[]");
      setFotosNoCarrinho(Array.isArray(salvas) ? salvas.map(String) : []);
    } catch {
      setFotosNoCarrinho([]);
    }
    setAberto(true);
  }

  function salvarCarrinho(ids: string[]) {
    const unicos = [...new Set(ids.map(String))];
    localStorage.setItem(CARRINHO_FOTOS_KEY, JSON.stringify(unicos));
    setFotosNoCarrinho(unicos);
    window.dispatchEvent(new CustomEvent("carrinho-fotos-atualizado", { detail: unicos }));
  }

  function alternarFoto(fotoId: string) {
    salvarCarrinho(
      fotosNoCarrinho.includes(fotoId)
        ? fotosNoCarrinho.filter((id) => id !== fotoId)
        : [...fotosNoCarrinho, fotoId],
    );
  }

  async function buscar(event: FormEvent) {
    event.preventDefault();
    const numeroLimpo = numero.replace(/\D/g, "").slice(0, 6);
    if (!numeroLimpo) {
      setErro("Informe o número visível no atleta, veículo ou participante.");
      return;
    }
    setBuscando(true);
    setErro("");
    setResultados(null);
    try {
      const response = await fetch("/api/fotos/buscar-por-numero", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numero: numeroLimpo, eventoId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível pesquisar este número.");
      setResultados((data.resultados || []) as ResultadoNumero[]);
    } catch (error: unknown) {
      setErro(error instanceof Error ? error.message : "Não foi possível pesquisar este número.");
    } finally {
      setBuscando(false);
    }
  }

  const idsResultados = resultados?.map((foto) => String(foto.id)) || [];
  const selecionadas = idsResultados.filter((id) => fotosNoCarrinho.includes(id)).length;

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className={triggerClassName || "flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl border border-orange-400/30 bg-orange-500/10 px-5 text-[10px] font-black uppercase tracking-widest text-orange-300 transition hover:bg-orange-500 hover:text-black md:h-14"}
      >
        <Hash size={16} /> {triggerLabel || "Buscar por número"}
      </button>

      {aberto && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[110] flex items-start justify-center bg-black/90 p-2 backdrop-blur-md sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Busca por número">
          <div className="flex max-h-[calc(100dvh-1rem)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#09090b] shadow-2xl sm:max-h-[calc(100dvh-2rem)] md:rounded-3xl">
            <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3 md:px-5 md:py-4">
              <div>
                <p className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-[0.18em] text-orange-400"><Hash size={13} /> Busca inteligente por número</p>
                <h2 className="mt-1 text-base font-black uppercase sm:text-lg">Encontre fotos pela identificação</h2>
              </div>
              <button type="button" onClick={() => setAberto(false)} className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-zinc-400 hover:bg-white hover:text-black" aria-label="Fechar"><X size={18} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-5">
              <form onSubmit={buscar} className="mx-auto flex max-w-xl flex-col gap-2 sm:flex-row">
                <label className="flex h-12 flex-1 items-center rounded-xl border border-white/10 bg-black px-4 focus-within:border-orange-400/50">
                  <Hash size={17} className="mr-2 text-orange-400" />
                  <input
                    value={numero}
                    onChange={(event) => setNumero(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    inputMode="numeric"
                    autoFocus
                    placeholder="Ex.: 27, 104 ou 5123"
                    className="w-full bg-transparent text-sm font-black text-white outline-none placeholder:font-medium placeholder:text-zinc-600"
                  />
                </label>
                <button disabled={buscando} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-orange-500 px-6 text-[9px] font-black uppercase tracking-widest text-black disabled:opacity-50">
                  {buscando ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />} Pesquisar
                </button>
              </form>
              <p className="mx-auto mt-2 max-w-xl text-[10px] leading-4 text-zinc-500">
                Disponível para {BUSCA_NUMERO_MODALIDADES}. A Retratt lê números visíveis em camisetas, veículos e identificações usando apenas as miniaturas.
              </p>

              {erro && <div className="mx-auto mt-5 max-w-xl rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">{erro}</div>}
              {buscando && <div className="flex min-h-64 flex-col items-center justify-center"><Loader2 size={38} className="animate-spin text-orange-400" /><p className="mt-3 text-[10px] font-black uppercase tracking-widest text-zinc-400">Lendo o índice da galeria</p></div>}
              {!buscando && resultados?.length === 0 && (
                <div className="mt-6 flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 p-6 text-center">
                  <Hash size={38} className="mb-3 text-zinc-700" />
                  <p className="text-sm font-black uppercase">Nenhuma foto com este número</p>
                  <p className="mt-2 text-xs text-zinc-500">O número pode estar encoberto ou a galeria ainda pode estar sendo indexada.</p>
                </div>
              )}
              {!buscando && resultados && resultados.length > 0 && (
                <div className="mt-6">
                  <p className="mb-4 flex items-center gap-2 text-sm font-black uppercase"><CheckCircle2 size={17} className="text-emerald-400" /> {resultados.length} foto(s) encontrada(s)</p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                    {resultados.map((foto) => {
                      const fotoId = String(foto.id);
                      const noCarrinho = fotosNoCarrinho.includes(fotoId);
                      return (
                        <article key={fotoId} className={`relative overflow-hidden rounded-xl border bg-black ${noCarrinho ? "border-emerald-400" : "border-white/10 hover:border-orange-400/50"}`}>
                          <label className={`absolute right-2 top-2 z-20 flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border backdrop-blur-md ${noCarrinho ? "border-emerald-300 bg-emerald-400 text-black" : "border-white/20 bg-black/70 text-white"}`}>
                            <input type="checkbox" checked={noCarrinho} onChange={() => alternarFoto(fotoId)} className="h-5 w-5 accent-emerald-500" aria-label={`${noCarrinho ? "Remover" : "Adicionar"} foto no carrinho`} />
                          </label>
                          <Link href={`/fotos/evento/${foto.eventoId}?foto=${encodeURIComponent(fotoId)}&origem=numero`} className="block">
                            <div className="relative aspect-[4/5] overflow-hidden bg-zinc-950">
                              <img data-foto-protegida-imagem src={`/api/fotos/arquivo/${fotoId}?tipo=thumb`} alt={foto.titulo || "Foto encontrada"} className={`h-full w-full object-cover ${noCarrinho ? "opacity-70" : ""}`} />
                              <span className="absolute left-2 top-2 rounded-full bg-orange-500 px-2 py-1 text-[8px] font-black text-black">Nº {numero}</span>
                            </div>
                            <div className="p-2.5">
                              <p className="line-clamp-2 text-[9px] font-black uppercase leading-4">{foto.evento?.nome || "Galeria Retratt"}</p>
                              <p className="mt-1 text-[8px] font-black uppercase tracking-wider text-orange-400">Abrir esta foto</p>
                            </div>
                          </Link>
                        </article>
                      );
                    })}
                  </div>
                  {selecionadas > 0 && (
                    <div className="sticky bottom-0 z-30 mt-4 flex items-center justify-between rounded-2xl border border-emerald-400/30 bg-[#101512]/95 p-3 backdrop-blur-xl">
                      <p className="text-[9px] font-black uppercase">{selecionadas} no carrinho</p>
                      <Link href="/fotos/carrinho" className="flex h-10 items-center gap-2 rounded-xl bg-emerald-400 px-4 text-[8px] font-black uppercase text-black"><ShoppingCart size={14} /> Abrir carrinho</Link>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
