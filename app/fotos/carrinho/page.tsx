"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import { formatarPrecoFotos } from "@/app/lib/fotos";
import FotosShell from "../_components/FotosShell";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Copy,
  Gift,
  Image as ImageIcon,
  Loader2,
  QrCode,
  ShieldCheck,
  Trash2,
  Wallet,
} from "lucide-react";

declare global {
  interface Window {
    MercadoPago?: any;
    fotosPaymentBrickController?: any;
  }
}

type EtapaPagamento = "carrinho" | "preparando" | "checkout" | "pago";

type CheckoutData = {
  publicKey: string;
  preferenceId: string;
  pedidoId: string;
  eventoNome: string;
  total: number;
};

type ResultadoPagamento = {
  id?: string | number;
  pedidoId?: string;
  status?: string;
  qr_code?: string;
  qr_code_base64?: string;
  ticket_url?: string;
};

type FotoCarrinho = {
  id: string;
  evento: string;
  fotografo: string;
  precoCentavos: number;
  imagem: string;
  comboQtd: number;
  comboPercentual: number;
};

const CARRINHO_FOTOS_KEY = "carrinho_fotos";
const COMBO_QTD_PADRAO = 3;
const COMBO_PERCENTUAL_PADRAO = 20;

function primeiraRelacao(valor: any) {
  return Array.isArray(valor) ? valor[0] : valor;
}

function carregarSdkMercadoPago() {
  return new Promise<void>((resolve, reject) => {
    if (window.MercadoPago) return resolve();
    const existente = document.querySelector<HTMLScriptElement>('script[src="https://sdk.mercadopago.com/js/v2"]');
    if (existente) {
      existente.addEventListener("load", () => resolve(), { once: true });
      existente.addEventListener("error", () => reject(new Error("Falha ao carregar Mercado Pago.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://sdk.mercadopago.com/js/v2";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Falha ao carregar Mercado Pago."));
    document.body.appendChild(script);
  });
}

export default function FotosCarrinhoPage() {
  const router = useRouter();
  const [fotos, setFotos] = useState<FotoCarrinho[]>([]);
  const [etapa, setEtapa] = useState<EtapaPagamento>("carrinho");
  const [copiado, setCopiado] = useState(false);
  const [carregandoCart, setCarregandoCart] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [checkoutData, setCheckoutData] = useState<CheckoutData | null>(null);
  const [resultadoPagamento, setResultadoPagamento] = useState<ResultadoPagamento | null>(null);
  const [mensagemPagamento, setMensagemPagamento] = useState("");

  const subtotal = fotos.reduce((acc, foto) => acc + foto.precoCentavos, 0);
  const comboQtd = fotos[0]?.comboQtd || COMBO_QTD_PADRAO;
  const comboPercentual = fotos[0]?.comboPercentual ?? COMBO_PERCENTUAL_PADRAO;
  const temDesconto = fotos.length >= comboQtd && comboPercentual > 0;
  const valorDesconto = temDesconto ? Math.round(subtotal * (comboPercentual / 100)) : 0;
  const total = subtotal - valorDesconto;

  useEffect(() => {
    async function carregarCarrinho() {
      try {
        const { data: auth } = await supabase.auth.getUser();
        setUserId(auth.user?.id || null);
        const idsSalvos = JSON.parse(localStorage.getItem(CARRINHO_FOTOS_KEY) || "[]").map(String);

        if (!idsSalvos.length) {
          setFotos([]);
          setCarregandoCart(false);
          return;
        }

        let consulta: any = await supabase
          .from("foto_arquivos")
          .select(`
            id,
            titulo,
            preco_centavos,
            preview_url,
            thumb_url,
            status,
            evento_dados:foto_eventos!evento_id ( nome, desconto_combo_qtd, desconto_combo_percentual ),
            fotografo_dados:fotografos!fotografo_id ( nome )
          `)
          .in("id", idsSalvos)
          .eq("status", "publicada");

        if (consulta.error) {
          consulta = await supabase
            .from("foto_arquivos")
            .select("id, titulo, preco_centavos, preview_url, thumb_url, status")
            .in("id", idsSalvos)
            .eq("status", "publicada");
        }

        if (consulta.error) throw consulta.error;

        const mapa = new Map((consulta.data || []).map((foto: any) => [String(foto.id), foto]));
        const fotosReais = idsSalvos
          .map((id: string) => mapa.get(id))
          .filter(Boolean)
          .map((foto: any) => {
            // Agora puxamos pelo apelido exato que demos na query acima!
            const evento = primeiraRelacao(foto.evento_dados);
            const fotografo = primeiraRelacao(foto.fotografo_dados);
            
            return {
              id: String(foto.id),
              evento: evento?.nome || "Evento Oficial",
              fotografo: fotografo?.nome || "Fotógrafo Parceiro",
              precoCentavos: Number(foto.preco_centavos || 0),
              imagem: `/api/fotos/arquivo/${foto.id}?tipo=preview`,
              comboQtd: Number(evento?.desconto_combo_qtd || COMBO_QTD_PADRAO),
              comboPercentual: Number(evento?.desconto_combo_percentual ?? COMBO_PERCENTUAL_PADRAO),
            };
          });

        setFotos(fotosReais);
        localStorage.setItem(CARRINHO_FOTOS_KEY, JSON.stringify(fotosReais.map((foto: FotoCarrinho) => foto.id)));
      } catch (err) {
        console.error("Erro ao carregar carrinho:", err);
      } finally {
        setCarregandoCart(false);
      }
    }

    carregarCarrinho();
  }, []);

  function removerFoto(id: string) {
    const novasFotos = fotos.filter((foto) => foto.id !== id);
    setFotos(novasFotos);
    localStorage.setItem(CARRINHO_FOTOS_KEY, JSON.stringify(novasFotos.map((foto) => foto.id)));
  }

  async function handleGerarPix() {
    if (!userId) {
      router.push("/fotos/login?perfil=comprador&next=/fotos/carrinho");
      return;
    }
    setEtapa("preparando");
    setMensagemPagamento("");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push("/fotos/login?perfil=comprador&next=/fotos/carrinho");
      return;
    }

    const response = await fetch("/api/fotos/pagamento/preparar", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ fotoIds: fotos.map((foto) => foto.id) }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMensagemPagamento(data.error || "Não foi possível preparar o pagamento.");
      setEtapa("carrinho");
      return;
    }
    setCheckoutData(data);
    setEtapa("checkout");
  }

  function handleCopiarPix() {
    if (!resultadoPagamento?.qr_code) return;
    navigator.clipboard.writeText(resultadoPagamento.qr_code);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 3000);
  }

  useEffect(() => {
    if (etapa !== "checkout" || !checkoutData) return;
    let cancelado = false;

    async function montarCheckout() {
      try {
        await carregarSdkMercadoPago();
        if (cancelado || !window.MercadoPago) return;
        if (window.fotosPaymentBrickController?.unmount) await window.fotosPaymentBrickController.unmount();

        const mp = new window.MercadoPago(checkoutData!.publicKey, { locale: "pt-BR" });
        window.fotosPaymentBrickController = await mp.bricks().create("payment", "fotosPaymentBrick", {
          initialization: {
            amount: checkoutData!.total,
            preferenceId: checkoutData!.preferenceId,
            marketplace: true,
          },
          customization: {
            paymentMethods: {
              ticket: "all",
              bankTransfer: "all",
              creditCard: "all",
              debitCard: "all",
              mercadoPago: "all",
              maxInstallments: 1,
            },
            visual: { style: { theme: "dark" } },
          },
          callbacks: {
            onReady: () => setMensagemPagamento(""),
            onSubmit: async ({ formData }: any) => {
              setMensagemPagamento("Processando pagamento...");
              const { data: { session } } = await supabase.auth.getSession();
              if (!session) throw new Error("Sessão expirada.");
              const response = await fetch("/api/fotos/pagamento/processar", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
                body: JSON.stringify({ pedidoId: checkoutData!.pedidoId, formData }),
              });
              const resultado = await response.json();
              if (!response.ok) throw new Error(resultado.error || "Pagamento recusado.");
              setResultadoPagamento(resultado);
              if (resultado.status === "approved") {
                localStorage.removeItem(CARRINHO_FOTOS_KEY);
                setEtapa("pago");
                setMensagemPagamento("Pagamento aprovado. Suas fotos foram liberadas.");
                window.setTimeout(() => router.push("/fotos/minhas-compras"), 1200);
              } else {
                setMensagemPagamento("Pagamento gerado. Aguardando confirmação.");
              }
            },
            onError: () => setMensagemPagamento("Não foi possível carregar o checkout."),
          },
        });
      } catch (error) {
        setMensagemPagamento(error instanceof Error ? error.message : "Erro ao carregar pagamento.");
      }
    }

    void montarCheckout();
    return () => {
      cancelado = true;
      if (window.fotosPaymentBrickController?.unmount) void window.fotosPaymentBrickController.unmount();
      window.fotosPaymentBrickController = undefined;
    };
  }, [checkoutData, etapa, router]);

  useEffect(() => {
    if (!checkoutData?.pedidoId || !resultadoPagamento?.id || resultadoPagamento.status === "approved") return;
    const intervalo = window.setInterval(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const response = await fetch(`/api/fotos/pagamento/status?pedido_id=${checkoutData.pedidoId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const status = await response.json();
      if (status.status === "pago") {
        window.clearInterval(intervalo);
        localStorage.removeItem(CARRINHO_FOTOS_KEY);
        setEtapa("pago");
        setMensagemPagamento("Pagamento confirmado. Suas fotos foram liberadas.");
        window.setTimeout(() => router.push("/fotos/minhas-compras"), 1200);
      }
    }, 5000);
    return () => window.clearInterval(intervalo);
  }, [checkoutData?.pedidoId, resultadoPagamento?.id, resultadoPagamento?.status, router]);

  return (
    <FotosShell>
      <main className="relative min-h-screen overflow-hidden bg-[#050505] pb-24 font-sans text-white">
        <div className="pointer-events-none absolute right-0 top-0 h-[500px] w-[500px] rounded-full bg-red-600/10 blur-[150px]" />

        <header className="sticky top-0 z-40 border-b border-white/5 bg-[#0a0a0e]/80 py-5 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 md:px-8">
            <Link href="/fotos" className="flex cursor-pointer items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-400 transition-colors hover:text-white">
              <ArrowLeft size={16} /> Voltar
            </Link>
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-emerald-400">
              <ShieldCheck size={14} /> Checkout 100% seguro
            </div>
          </div>
        </header>

        <section className="relative z-10 mx-auto mt-8 max-w-7xl px-4 md:mt-12 md:px-8">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tight text-white md:text-4xl">Carrinho</h1>
              {!carregandoCart && (
                <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                  Você selecionou {fotos.length} {fotos.length === 1 ? "foto" : "fotos"}
                </p>
              )}
            </div>
          </div>

          {carregandoCart ? (
            <div className="flex flex-col items-center justify-center py-32">
              <Loader2 size={40} className="mb-4 animate-spin text-red-500" />
              <p className="text-sm font-black uppercase tracking-widest text-zinc-400">Buscando as suas fotos...</p>
            </div>
          ) : fotos.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/5 bg-[#0a0a0e]/50 py-24 backdrop-blur-sm">
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-white/5 text-zinc-600 shadow-inner">
                <ImageIcon size={32} />
              </div>
              <h2 className="mb-2 text-xl font-black uppercase tracking-tight text-white">Carrinho vazio</h2>
              <p className="mb-8 text-xs font-medium text-zinc-500">Você ainda não separou as suas memórias de glória.</p>
              <Link href="/fotos" className="cursor-pointer rounded-xl bg-red-600 px-8 py-4 text-[10px] font-black uppercase tracking-widest text-white shadow-[0_0_30px_rgba(239,68,68,0.25)] transition-all hover:scale-105 hover:bg-red-500">
                Encontrar minhas fotos
              </Link>
            </div>
          ) : (
            <div className="grid items-start gap-6 md:gap-8 lg:grid-cols-[1fr_380px]">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {fotos.map((foto) => (
                  <div key={foto.id} className="group relative rounded-xl border border-white/5 bg-[#0a0a0e] p-2.5 transition-all duration-300 hover:border-red-500/30 hover:bg-red-500/5 hover:shadow-[0_10px_40px_rgba(239,68,68,0.05)]">
                    <div className="relative mb-3 aspect-square overflow-hidden rounded-lg bg-zinc-900">
                      <img src={foto.imagem} alt="Foto" className="h-full w-full object-cover opacity-90 transition-transform duration-700 group-hover:scale-110 group-hover:opacity-100" />
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
                        <span className="rotate-[-25deg] text-[10px] font-black uppercase tracking-[0.3em] text-white/60 mix-blend-overlay">iTatame Fotos</span>
                      </div>

                      {etapa === "carrinho" && (
                        <button onClick={() => removerFoto(foto.id)} className="absolute right-3 top-3 cursor-pointer rounded-lg bg-black/60 p-2.5 text-white opacity-0 shadow-lg backdrop-blur-md transition-all duration-300 hover:bg-red-600 group-hover:translate-y-0 group-hover:opacity-100" title="Remover foto">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>

                    <div className="flex items-end justify-between px-1">
                      <div className="min-w-0">
                        <p className="mb-1 truncate text-[8px] font-black uppercase tracking-[0.2em] text-red-500">{foto.evento}</p>
                        <p className="truncate text-xs font-bold uppercase tracking-wider text-white">{foto.fotografo}</p>
                      </div>
                      <p className="text-sm font-black text-white">{formatarPrecoFotos(foto.precoCentavos)}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="sticky top-28">
                <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0e]/90 p-5 shadow-2xl backdrop-blur-xl md:p-6">
                  <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-red-600 to-orange-500" />
                  <h3 className="mb-6 flex items-center gap-2 text-sm font-black uppercase tracking-widest text-white">
                    <Wallet size={16} className="text-red-500" /> Resumo
                  </h3>

                  {etapa === "carrinho" && (
                    <div className={`mb-5 rounded-xl border p-3 transition-colors ${temDesconto ? "border-emerald-500/30 bg-emerald-500/10" : "border-white/10 bg-white/5"}`}>
                      <div className="flex items-center gap-3">
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${temDesconto ? "bg-emerald-500/20 text-emerald-400" : "bg-white/10 text-zinc-400"}`}>
                          {temDesconto ? <Gift size={16} /> : <AlertCircle size={16} />}
                        </div>
                        <div>
                          <p className={`text-[10px] font-black uppercase tracking-wider ${temDesconto ? "text-emerald-400" : "text-white"}`}>
                            {temDesconto ? "Combo ativado" : "Pacote promocional"}
                          </p>
                          <p className="mt-0.5 text-[9px] text-zinc-400">
                            {temDesconto ? `Você ganhou ${comboPercentual}% de desconto.` : `Adicione mais ${comboQtd - fotos.length} foto(s) para ganhar ${comboPercentual}% OFF.`}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mb-6 space-y-4 text-sm font-medium">
                    <div className="flex justify-between text-zinc-400">
                      <span>Subtotal ({fotos.length} {fotos.length === 1 ? "item" : "itens"})</span>
                      <span>{formatarPrecoFotos(subtotal)}</span>
                    </div>
                    {temDesconto && (
                      <div className="flex justify-between text-emerald-400">
                        <span>Desconto Combo ({comboPercentual}%)</span>
                        <span>- {formatarPrecoFotos(valorDesconto)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-zinc-400">
                      <span>Taxa de sistema</span>
                      <span className="text-zinc-500">R$ 0,00</span>
                    </div>
                  </div>

                  <div className="mb-8 flex items-end justify-between border-t border-white/10 pt-6">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Total a pagar</span>
                    <div className="text-right">
                      {temDesconto && <p className="mb-1 text-[10px] text-zinc-500 line-through">De {formatarPrecoFotos(subtotal)}</p>}
                      <span className="bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-3xl font-black text-transparent md:text-4xl">
                        {formatarPrecoFotos(total)}
                      </span>
                    </div>
                  </div>

                  {etapa === "carrinho" && (
                    <button onClick={handleGerarPix} className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-red-600 text-[10px] font-black uppercase tracking-widest text-white shadow-[0_0_30px_rgba(239,68,68,0.25)] transition-all hover:scale-[1.02] hover:bg-red-500">
                      <QrCode size={16} /> Escolher forma de pagamento
                    </button>
                  )}

                  {etapa === "preparando" && (
                    <button disabled className="flex h-14 w-full cursor-wait items-center justify-center gap-3 rounded-2xl border border-white/5 bg-zinc-900 text-[11px] font-black uppercase tracking-widest text-zinc-500">
                      <Loader2 size={18} className="animate-spin text-red-500" /> Preparando checkout...
                    </button>
                  )}

                  {etapa === "checkout" && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <div id="fotosPaymentBrick" className={resultadoPagamento?.id ? "hidden" : ""} />
                      {resultadoPagamento?.qr_code_base64 && (
                        <div className="mb-4 flex justify-center rounded-xl bg-white p-4">
                          <img src={`data:image/png;base64,${resultadoPagamento.qr_code_base64}`} alt="QR Code Pix" className="h-44 w-44" />
                        </div>
                      )}
                      {resultadoPagamento?.qr_code && (
                        <button onClick={handleCopiarPix} className={`flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-5 text-[10px] font-black uppercase tracking-widest transition-all ${copiado ? "bg-emerald-500 text-black" : "border border-white/5 bg-white/10 text-white hover:bg-white/20"}`}>
                          {copiado ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                          {copiado ? "Código copiado" : "Copiar código Pix"}
                        </button>
                      )}
                    </div>
                  )}

                  {mensagemPagamento && (
                    <p className={`mt-4 rounded-xl border p-3 text-center text-[10px] font-bold ${etapa === "pago" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-amber-500/20 bg-amber-500/10 text-amber-200"}`}>
                      {mensagemPagamento}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
    </FotosShell>
  );
}
