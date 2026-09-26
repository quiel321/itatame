"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Eye, EyeOff, Image as ImageIcon, Images, Loader2, ShieldCheck, Tag, Trash2, Video, Wand2, X } from "lucide-react";
import { supabase } from "@/app/lib/supabase";
import { formatarPrecoFotos } from "@/app/lib/fotos";
import { gerarAmostraVideoRapida, webCodecsDisponivel } from "@/app/lib/fotos-video-amostra";

export type MidiaGaleria = {
  id: string;
  evento_id: string;
  fotografo_id: string | null;
  titulo: string | null;
  mime_type?: string | null;
  status: string;
  preco_centavos: number | null;
  situacao_pedido: "vendida" | "reservada" | "vinculada" | null;
  quantidade_vendas: number;
  quantidade_reservas: number;
  created_at: string;
  miniatura_url: string | null;
  sem_amostra_video?: boolean;
};

type Filtro = "todas" | "publicadas" | "ocultas" | "vendidas";

const FILTROS: Array<{ id: Filtro; rotulo: string }> = [
  { id: "todas", rotulo: "Todas" },
  { id: "publicadas", rotulo: "À venda" },
  { id: "ocultas", rotulo: "Ocultas" },
  { id: "vendidas", rotulo: "Vendidas" },
];

function filtrarMidias(midias: MidiaGaleria[], filtro: Filtro) {
  if (filtro === "publicadas") return midias.filter((midia) => midia.status === "publicada");
  if (filtro === "ocultas") return midias.filter((midia) => midia.status === "oculta");
  if (filtro === "vendidas") return midias.filter((midia) => midia.quantidade_vendas > 0);
  return midias;
}

function converterPrecoCentavos(valor: string) {
  const numero = Number(valor.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(numero) ? Math.round(numero * 100) : NaN;
}

async function tokenDaSessao() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Sessão expirada. Entre novamente.");
  return session.access_token;
}

// Lê a resposta em partes: `response.blob()` falha em alguns navegadores com arquivos grandes.
async function baixarEmPartes(url: string, onProgresso: (percentual: number) => void) {
  const resposta = await fetch(url, { cache: "no-store" });
  if (!resposta.ok || !resposta.body) throw new Error("Não foi possível baixar o vídeo original.");
  const total = Number(resposta.headers.get("content-length") || 0);
  const leitor = resposta.body.getReader();
  const partes: BlobPart[] = [];
  let recebidos = 0;
  let ultimoPercentual = -1;
  while (true) {
    const { done, value } = await leitor.read();
    if (done) break;
    partes.push(value);
    recebidos += value.byteLength;
    const percentual = total ? Math.floor((recebidos / total) * 100) : 0;
    if (percentual !== ultimoPercentual) {
      ultimoPercentual = percentual;
      onProgresso(percentual);
    }
  }
  return new Blob(partes, { type: resposta.headers.get("content-type") || "video/mp4" });
}

function CartaoMidia({
  midia,
  selecionada,
  onToggle,
  gerandoAmostra,
  onGerarAmostra,
}: {
  midia: MidiaGaleria;
  selecionada: boolean;
  onToggle: () => void;
  gerandoAmostra: boolean;
  onGerarAmostra: () => void;
}) {
  const [erroImagem, setErroImagem] = useState(false);
  const protegida = Boolean(midia.situacao_pedido);
  const oculta = midia.status === "oculta";
  const ehVideo = Boolean(midia.mime_type?.startsWith("video/"));
  const rotuloProtecao = midia.situacao_pedido === "vendida"
    ? `Vendida${midia.quantidade_vendas > 1 ? ` ${midia.quantidade_vendas}x` : ""}`
    : midia.situacao_pedido === "reservada"
      ? `Reservada${midia.quantidade_reservas > 1 ? ` ${midia.quantidade_reservas}x` : ""}`
      : "Vinculada";
  const corProtecao = midia.situacao_pedido === "vendida"
    ? "border-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.38)]"
    : "border-retratt shadow-[0_0_14px_rgba(255,90,31,0.28)]";
  const fundoProtecao = midia.situacao_pedido === "vendida"
    ? "bg-emerald-400 text-emerald-950"
    : midia.situacao_pedido === "reservada"
      ? "bg-retratt text-orange-950"
      : "bg-retratt text-black";

  return (
    <div
      onClick={onToggle}
      title={protegida ? `${rotuloProtecao}: pode ser ocultada, mas não excluída` : "Selecionar mídia"}
      className={`relative aspect-square cursor-pointer overflow-hidden rounded-xl border-2 bg-zinc-900 transition-all ${selecionada ? "border-retratt" : protegida ? corProtecao : "border-transparent hover:border-white/20"}`}
    >
      {midia.miniatura_url && !erroImagem ? (
        <img
          src={midia.miniatura_url}
          alt={midia.titulo || "Mídia"}
          loading="lazy"
          onError={() => setErroImagem(true)}
          className={`h-full w-full object-cover transition-opacity ${selecionada ? "opacity-40" : oculta ? "opacity-35 grayscale" : protegida ? "opacity-65" : "opacity-100"}`}
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0a0e] p-2 text-center">
          {ehVideo ? <Video size={20} className="mb-1 text-retratt" /> : <ImageIcon size={20} className="mb-1 text-zinc-700" />}
          <span className="text-[7px] font-black uppercase tracking-widest text-zinc-500">Miniatura indisponível</span>
        </div>
      )}

      {protegida && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20 px-1">
          <span className={`rounded-md px-2 py-1 text-[8px] font-black uppercase tracking-[0.16em] shadow-lg ${fundoProtecao}`}>{rotuloProtecao}</span>
        </div>
      )}

      {oculta && (
        <span className="pointer-events-none absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-black/85 px-2 py-1 text-[7px] font-black uppercase tracking-wider text-zinc-300">
          <EyeOff size={9} /> Oculta
        </span>
      )}
      {midia.status === "processando" && (
        <span className="pointer-events-none absolute left-2 top-2 rounded-md bg-amber-400 px-2 py-1 text-[7px] font-black uppercase tracking-wider text-black">Envio incompleto</span>
      )}
      {midia.sem_amostra_video && midia.status !== "processando" && (
        <div className="absolute inset-x-2 top-1/2 flex -translate-y-1/2 justify-center">
          <button
            type="button"
            disabled={gerandoAmostra}
            onClick={(e) => { e.stopPropagation(); onGerarAmostra(); }}
            title="O vídeo está sem amostra para o cliente. Gere agora a partir do original."
            className="inline-flex cursor-pointer items-center gap-1 rounded-md bg-amber-400 px-2 py-1.5 text-[7px] font-black uppercase tracking-wider text-black shadow-lg transition hover:brightness-110 disabled:cursor-wait disabled:opacity-80"
          >
            {gerandoAmostra ? <Loader2 size={10} className="animate-spin" /> : <Wand2 size={10} />}
            {gerandoAmostra ? "Gerando..." : "Gerar amostra"}
          </button>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-2 bottom-2 flex items-center justify-between gap-1">
        {ehVideo ? <span className="rounded-md bg-black/80 px-2 py-1 text-[7px] font-black uppercase tracking-wider text-white"><Video size={9} className="mr-1 inline" />Vídeo</span> : <span />}
        {midia.preco_centavos != null && (
          <span className="rounded-md bg-black/80 px-2 py-1 text-[7px] font-black tracking-wider text-emerald-300">{formatarPrecoFotos(midia.preco_centavos)}</span>
        )}
      </div>

      <div className={`absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-md border transition-colors ${selecionada ? "border-retratt bg-retratt" : protegida ? "border-white/30 bg-black/75" : "border-white/50 bg-black/50"}`}>
        {selecionada ? <Check size={12} className="text-white" /> : protegida && <ShieldCheck size={11} className="text-white" />}
      </div>
    </div>
  );
}

export default function GerenciadorMidias({
  galeriaId,
  precoBloqueado,
  onFechar,
  onMidiasExcluidas,
}: {
  galeriaId: string;
  precoBloqueado?: boolean;
  onFechar: () => void;
  onMidiasExcluidas?: (quantidade: number) => void;
}) {
  const [midias, setMidias] = useState<MidiaGaleria[]>([]);
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [novoPreco, setNovoPreco] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState<"" | "excluir" | "ocultar" | "publicar" | "preco">("");
  const [mensagem, setMensagem] = useState("");
  const [gerandoAmostraId, setGerandoAmostraId] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setSelecionadas([]);
    try {
      const token = await tokenDaSessao();
      const response = await fetch(`/api/fotos/fotografo/gerenciar-fotos?eventoId=${encodeURIComponent(galeriaId)}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const resultado = await response.json().catch(() => null);
      if (!response.ok) throw new Error(resultado?.error || "Não foi possível carregar as mídias.");
      setMidias(resultado?.fotos || []);
    } catch (error) {
      setMidias([]);
      setMensagem(error instanceof Error ? error.message : "Não foi possível carregar as mídias.");
    } finally {
      setCarregando(false);
    }
  }, [galeriaId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void carregar(), 0);
    return () => window.clearTimeout(timer);
  }, [carregar]);

  const visiveis = useMemo(() => filtrarMidias(midias, filtro), [midias, filtro]);
  const selecionadasSet = useMemo(() => new Set(selecionadas), [selecionadas]);
  const selecionadasExcluiveis = useMemo(
    () => midias.filter((midia) => selecionadasSet.has(midia.id) && !midia.situacao_pedido).map((midia) => midia.id),
    [midias, selecionadasSet],
  );
  const totalVendas = midias.reduce((total, midia) => total + midia.quantidade_vendas, 0);
  const totalOcultas = midias.filter((midia) => midia.status === "oculta").length;
  const todasVisiveisSelecionadas = visiveis.length > 0 && visiveis.every((midia) => selecionadasSet.has(midia.id));

  function alternarSelecao(id: string) {
    setSelecionadas((atuais) => atuais.includes(id) ? atuais.filter((item) => item !== id) : [...atuais, id]);
  }

  function alternarTodasVisiveis() {
    const idsVisiveis = visiveis.map((midia) => midia.id);
    setSelecionadas((atuais) => todasVisiveisSelecionadas
      ? atuais.filter((id) => !idsVisiveis.includes(id))
      : Array.from(new Set([...atuais, ...idsVisiveis])));
  }

  async function atualizar(acao: "ocultar" | "publicar" | "preco") {
    if (!selecionadas.length) return;
    const precoCentavos = acao === "preco" ? converterPrecoCentavos(novoPreco) : undefined;
    if (acao === "preco" && (!Number.isFinite(precoCentavos) || Number(precoCentavos) < 100)) {
      setMensagem("Informe um preço válido, a partir de R$ 1,00.");
      return;
    }

    setProcessando(acao);
    setMensagem("");
    try {
      const token = await tokenDaSessao();
      const response = await fetch("/api/fotos/fotografo/atualizar-midias", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ acao, fotoIds: selecionadas, precoCentavos }),
      });
      const resultado = await response.json().catch(() => null);
      if (!response.ok) throw new Error(resultado?.error || "Não foi possível atualizar as mídias.");

      const atualizadas = new Map<string, { status: string; preco_centavos: number | null }>(
        (resultado?.atualizadas || []).map((item: { id: string; status: string; preco_centavos: number | null }) => [item.id, item]),
      );
      setMidias((atuais) => atuais.map((midia) => {
        const nova = atualizadas.get(midia.id);
        return nova ? { ...midia, status: nova.status, preco_centavos: nova.preco_centavos } : midia;
      }));
      setSelecionadas([]);
      if (acao === "preco") setNovoPreco("");

      const verbo = acao === "ocultar" ? "ocultada(s)" : acao === "publicar" ? "colocada(s) à venda" : "com preço atualizado";
      const ignoradas = Number(resultado?.ignoradas || 0);
      setMensagem(`${atualizadas.size} mídia(s) ${verbo}.${ignoradas ? ` ${ignoradas} já estavam nessa situação ou ainda não foram publicadas.` : ""}`);
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : "Não foi possível atualizar as mídias.");
    } finally {
      setProcessando("");
    }
  }

  async function excluir() {
    if (!selecionadasExcluiveis.length) return;
    const protegidas = selecionadas.length - selecionadasExcluiveis.length;
    const aviso = protegidas ? `\n\n${protegidas} mídia(s) com pedido serão mantidas.` : "";
    if (!confirm(`Excluir ${selecionadasExcluiveis.length} mídia(s)? Os arquivos serão apagados do sistema e da nuvem.${aviso}`)) return;

    setProcessando("excluir");
    setMensagem("");
    try {
      const token = await tokenDaSessao();
      const response = await fetch("/api/fotos/fotografo/excluir-fotos", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fotoIds: selecionadasExcluiveis }),
      });
      const resultado = await response.json().catch(() => null);
      if (!response.ok) throw new Error(resultado?.error || "Não foi possível excluir as mídias.");

      const excluidas: string[] = Array.isArray(resultado?.excluidas) ? resultado.excluidas : [];
      setMidias((atuais) => atuais.filter((midia) => !excluidas.includes(midia.id)));
      setSelecionadas([]);
      onMidiasExcluidas?.(excluidas.length);
      setMensagem(resultado?.aviso || `${excluidas.length} mídia(s) excluída(s).`);
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : "Não foi possível excluir as mídias.");
    } finally {
      setProcessando("");
    }
  }

  async function gerarAmostra(fotoId: string) {
    if (gerandoAmostraId) return;
    if (!webCodecsDisponivel()) {
      setMensagem("Este navegador não consegue gerar amostras. Use o Chrome, Edge ou Safari atualizado.");
      return;
    }

    setGerandoAmostraId(fotoId);
    setMensagem("Preparando o vídeo original...");
    try {
      const token = await tokenDaSessao();
      const chamar = async (etapa: "preparar" | "confirmar") => {
        const response = await fetch("/api/fotos/fotografo/amostra-video", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ fotoId, etapa }),
        });
        const resultado = await response.json().catch(() => null);
        if (!response.ok) throw new Error(resultado?.error || "Não foi possível gerar a amostra.");
        return resultado as { originalUrl?: string; uploadUrl?: string };
      };

      const { originalUrl, uploadUrl } = await chamar("preparar");
      if (!originalUrl || !uploadUrl) throw new Error("Não foi possível preparar a amostra.");

      const original = await baixarEmPartes(originalUrl, (percentual) => {
        setMensagem(`Baixando o vídeo original (${percentual}%)...`);
      });
      setMensagem("Gerando a amostra protegida...");
      const amostra = await gerarAmostraVideoRapida(original, (percentual) => {
        setMensagem(`Gerando a amostra protegida (${percentual}%)...`);
      });
      if (!amostra) {
        throw new Error("O navegador não conseguiu ler este vídeo (comum em HEVC/H.265 do iPhone). Exporte em MP4 (H.264) e envie novamente.");
      }

      const envio = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": "video/mp4" }, body: amostra });
      if (!envio.ok) throw new Error(`O armazenamento recusou a amostra (${envio.status}).`);
      await chamar("confirmar");

      setMidias((atuais) => atuais.map((midia) => midia.id === fotoId ? { ...midia, sem_amostra_video: false } : midia));
      setMensagem(`Amostra gerada (${Math.max(1, Math.round(amostra.size / 1024))} KB). O cliente já consegue assistir à prévia.`);
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : "Não foi possível gerar a amostra.");
    } finally {
      setGerandoAmostraId(null);
    }
  }

  const botaoAcao = "flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 text-[8px] font-black uppercase tracking-widest transition-colors disabled:cursor-not-allowed disabled:opacity-40 sm:text-[9px]";

  return (
    <div className="mt-4 mb-2 overflow-hidden rounded-2xl border border-retratt/30 bg-[#050505] shadow-[0_0_30px_rgba(255,90,31,0.05)] animate-in slide-in-from-top-2 fade-in duration-200 sm:mt-6">
      <div className="flex items-center justify-between border-b border-white/5 bg-retratt/[0.02] px-4 py-3 sm:px-5 sm:py-4">
        <div className="flex items-center gap-2">
          <Images size={16} className="shrink-0 text-retratt" />
          <h3 className="text-xs font-black uppercase tracking-tight text-white sm:text-sm">Gerenciar mídias</h3>
        </div>
        <button type="button" onClick={onFechar} className="cursor-pointer p-1 text-zinc-500 transition-colors hover:text-white" aria-label="Fechar">
          <X size={16} className="shrink-0" />
        </button>
      </div>

      <div className="space-y-3 border-b border-white/5 bg-[#0a0a0e] p-3 sm:p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {FILTROS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFiltro(item.id)}
                className={`h-7 cursor-pointer rounded-full px-3 text-[8px] font-black uppercase tracking-widest transition-colors ${filtro === item.id ? "bg-retratt text-black" : "bg-white/5 text-zinc-400 hover:bg-white/10"}`}
              >
                {item.rotulo} ({filtrarMidias(midias, item.id).length})
              </button>
            ))}
          </div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">
            {selecionadas.length} selecionada(s){totalVendas > 0 && ` • ${totalVendas} venda(s)`}{totalOcultas > 0 && ` • ${totalOcultas} oculta(s)`}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <button type="button" disabled={!visiveis.length} onClick={alternarTodasVisiveis} className={`${botaoAcao} bg-white/5 text-white hover:bg-white/10`}>
            {todasVisiveisSelecionadas ? "Desmarcar" : "Selecionar todas"}
          </button>
          <button type="button" disabled={!selecionadas.length || Boolean(processando)} onClick={() => void atualizar("ocultar")} className={`${botaoAcao} border border-white/10 bg-white/5 text-zinc-300 hover:bg-white hover:text-black`}>
            {processando === "ocultar" ? <Loader2 size={12} className="animate-spin" /> : <EyeOff size={12} />} Ocultar
          </button>
          <button type="button" disabled={!selecionadas.length || Boolean(processando)} onClick={() => void atualizar("publicar")} className={`${botaoAcao} border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-400 hover:text-black`}>
            {processando === "publicar" ? <Loader2 size={12} className="animate-spin" /> : <Eye size={12} />} Pôr à venda
          </button>
          <button type="button" disabled={!selecionadasExcluiveis.length || Boolean(processando)} onClick={() => void excluir()} className={`${botaoAcao} border border-retratt/20 bg-retratt/10 text-retratt hover:bg-retratt hover:text-white`}>
            {processando === "excluir" ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} Excluir{selecionadasExcluiveis.length ? ` (${selecionadasExcluiveis.length})` : ""}
          </button>
          {!precoBloqueado && <div className="col-span-2 flex items-center gap-2 sm:ml-auto">
            <div className="relative flex-1 sm:w-28 sm:flex-none">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-zinc-500">R$</span>
              <input value={novoPreco} onChange={(e) => setNovoPreco(e.target.value)} inputMode="decimal" placeholder="0,00" className="h-8 w-full rounded-lg border border-white/10 bg-black pl-8 pr-2 text-xs font-bold text-white outline-none focus:border-retratt" />
            </div>
            <button type="button" disabled={!selecionadas.length || !novoPreco.trim() || Boolean(processando)} onClick={() => void atualizar("preco")} className={`${botaoAcao} bg-retratt text-black hover:brightness-110`}>
              {processando === "preco" ? <Loader2 size={12} className="animate-spin" /> : <Tag size={12} />} Aplicar preço
            </button>
          </div>}
        </div>

        {mensagem && <p className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[10px] font-bold text-zinc-300">{mensagem}</p>}
      </div>

      <div className="custom-scrollbar max-h-[460px] overflow-y-auto p-3 sm:p-5">
        {carregando ? (
          <div className="flex justify-center py-10"><Loader2 size={24} className="animate-spin text-retratt" /></div>
        ) : visiveis.length === 0 ? (
          <p className="py-10 text-center text-[10px] font-bold uppercase tracking-widest text-zinc-500">
            {midias.length ? "Nenhuma mídia neste filtro." : "Nenhuma mídia nesta galeria."}
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 md:grid-cols-5 lg:grid-cols-6">
            {visiveis.map((midia) => (
              <CartaoMidia
                key={midia.id}
                midia={midia}
                selecionada={selecionadasSet.has(midia.id)}
                onToggle={() => alternarSelecao(midia.id)}
                gerandoAmostra={gerandoAmostraId === midia.id}
                onGerarAmostra={() => void gerarAmostra(midia.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
