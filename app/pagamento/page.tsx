"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import Link from "next/link";

declare global {
  interface Window {
    MercadoPago?: any;
    paymentBrickController?: any;
  }
}

type CheckoutData = {
  publicKey: string;
  preferenceId: string;
  inscricaoId: string | number;
  eventoNome: string;
  valorTotal: number;
  comissao: number;
  plano: string;
};

function carregarSdkMercadoPago() {
  return new Promise<void>((resolve, reject) => {
    if (window.MercadoPago) {
      resolve();
      return;
    }

    const scriptExistente = document.querySelector<HTMLScriptElement>('script[src="https://sdk.mercadopago.com/js/v2"]');
    if (scriptExistente) {
      scriptExistente.addEventListener("load", () => resolve(), { once: true });
      scriptExistente.addEventListener("error", () => reject(new Error("Falha ao carregar Mercado Pago.")), { once: true });
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

export default function PagamentoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [inscricoes, setInscricoes] = useState<any[]>([]);
  const [abaAtiva, setAbaAtiva] = useState<"pendentes" | "pagas">("pendentes");
  const [inscricaoSelecionada, setInscricaoSelecionada] = useState<any>(null);
  const [processandoPagamento, setProcessandoPagamento] = useState(false);
  const [checkoutAberto, setCheckoutAberto] = useState(false);
  const [checkoutData, setCheckoutData] = useState<CheckoutData | null>(null);
  const [brickCarregando, setBrickCarregando] = useState(false);
  const [checkoutMensagem, setCheckoutMensagem] = useState("");

  useEffect(() => {
    carregarInscricoes();
  }, [router]);

  useEffect(() => {
    if (!checkoutAberto || !checkoutData) return;

    let cancelado = false;

    async function renderizarBrick() {
      setBrickCarregando(true);
      setCheckoutMensagem("");

      try {
        await carregarSdkMercadoPago();
        if (cancelado || !checkoutData) return;

        if (window.paymentBrickController?.unmount) {
          window.paymentBrickController.unmount();
        }

        const mp = new window.MercadoPago(checkoutData.publicKey, { locale: "pt-BR" });
        const bricksBuilder = mp.bricks();

        window.paymentBrickController = await bricksBuilder.create("payment", "paymentBrick_container", {
          initialization: {
            amount: checkoutData.valorTotal,
            preferenceId: checkoutData.preferenceId,
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
            visual: {
              style: {
                theme: "dark",
              },
            },
          },
          callbacks: {
            onReady: () => setBrickCarregando(false),
            onSubmit: ({ formData }: any) => {
              setCheckoutMensagem("Processando pagamento...");
              return fetch("/api/pagamento/mercado-pago/processar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ inscricaoId: checkoutData.inscricaoId, formData }),
              })
                .then(async (response) => {
                  const data = await response.json();
                  if (!response.ok) throw new Error(data.error || "Pagamento recusado.");

                  if (data.status === "approved") {
                    setCheckoutMensagem("Pagamento aprovado! Redirecionando para seu passaporte...");
                    await carregarInscricoes();
                    setAbaAtiva("pagas");

                    window.setTimeout(() => {
                      const destinoPassaporte = inscricaoSelecionada?.evento_id && inscricaoSelecionada?.user_id
                        ? `/ingresso/${inscricaoSelecionada.evento_id}/${inscricaoSelecionada.user_id}`
                        : "/pagamento";

                      fecharCheckout();
                      router.push(destinoPassaporte);
                    }, 1200);
                  } else if (data.status === "pending" || data.status === "in_process") {
                    setCheckoutMensagem("Pagamento gerado. Assim que for aprovado, a inscrição será liberada automaticamente.");
                  } else {
                    setCheckoutMensagem("Pagamento enviado ao Mercado Pago. Aguarde a confirmação.");
                  }
                })
                .catch((error) => {
                  setCheckoutMensagem(error.message || "Não foi possível processar o pagamento.");
                  throw error;
                });
            },
            onError: (error: any) => {
              console.error("Erro no Checkout Bricks:", error);
              setCheckoutMensagem("O Mercado Pago não conseguiu carregar o checkout. Tente novamente.");
              setBrickCarregando(false);
            },
          },
        });
      } catch (error: any) {
        if (!cancelado) {
          setCheckoutMensagem(error.message || "Erro ao carregar Mercado Pago.");
          setBrickCarregando(false);
        }
      }
    }

    renderizarBrick();

    return () => {
      cancelado = true;
      if (window.paymentBrickController?.unmount) {
        window.paymentBrickController.unmount();
        window.paymentBrickController = undefined;
      }
    };
  }, [checkoutAberto, checkoutData]);

  async function carregarInscricoes() {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      router.push("/login");
      return;
    }

    try {
      const { data: depsData, error: depsError } = await supabase
        .from("atletas")
        .select("user_id")
        .eq("responsavel_id", authData.user.id);

      const idsFamilia = [authData.user.id];
      if (depsData && !depsError) {
        depsData.forEach((d) => idsFamilia.push(d.user_id));
      }

      const { data, error } = await supabase
        .from("inscricoes")
        .select(`
          *,
          eventos (
            nome,
            data_evento,
            banner_url,
            cidade,
            estado
          )
        `)
        .in("user_id", idsFamilia)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setInscricoes(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar pagamentos:", error.message || error);
    } finally {
      setLoading(false);
    }
  }

  async function iniciarPagamentoMercadoPago(inscricao: any) {
    setInscricaoSelecionada(inscricao);
    setProcessandoPagamento(true);
    setCheckoutMensagem("");

    try {
      const response = await fetch("/api/pagamento/mercado-pago/preferencia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inscricaoId: inscricao.id }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível iniciar o pagamento.");

      if (data.pago) {
        await carregarInscricoes();
        setAbaAtiva("pagas");
        return;
      }

      setCheckoutData(data);
      setCheckoutAberto(true);
    } catch (error: any) {
      alert(error.message || "Erro ao abrir o Mercado Pago.");
    } finally {
      setProcessandoPagamento(false);
    }
  }

  function fecharCheckout() {
    setCheckoutAberto(false);
    setCheckoutData(null);
    setCheckoutMensagem("");
    if (window.paymentBrickController?.unmount) {
      window.paymentBrickController.unmount();
      window.paymentBrickController = undefined;
    }
  }

  const formatarData = (dataStr: string) => {
    if (!dataStr) return "Data a definir";
    const [ano, mes, dia] = dataStr.split("-");
    return `${dia}/${mes}/${ano}`;
  };

  const formatarMoeda = (valor: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor || 0);

  const pendentes = inscricoes.filter((i) => !i.pagamento_ok);
  const pagas = inscricoes.filter((i) => i.pagamento_ok);

  if (loading) {
    return <div className="min-h-screen bg-[#050505] flex items-center justify-center text-zinc-500 font-bold uppercase tracking-widest text-xs">Carregando faturas...</div>;
  }

  return (
    <main className="min-h-screen bg-[#050505] p-4 md:p-8 font-sans relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-red-600/5 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="max-w-4xl mx-auto relative z-10 pt-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <Link href="/perfil" className="text-zinc-500 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center gap-1 mb-2">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"></path></svg>
              Voltar ao Perfil
            </Link>
            <h1 className="text-2xl md:text-3xl font-black text-white flex items-center gap-3 tracking-tight">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>
              Central de Pagamentos
            </h1>
            <p className="text-zinc-400 text-sm mt-1">Gerencie suas inscrições pendentes e acesse seus passaportes.</p>
          </div>
        </div>

        <div className="flex bg-[#0e0e12] p-1.5 rounded-xl border border-white/5 w-full md:w-max mb-6">
          <button
            onClick={() => setAbaAtiva("pendentes")}
            className={`flex-1 md:flex-none px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${abaAtiva === "pendentes" ? "bg-red-600 text-white shadow-md" : "text-zinc-500 hover:text-white"}`}
          >
            Faturas Pendentes {pendentes.length > 0 && `(${pendentes.length})`}
          </button>
          <button
            onClick={() => setAbaAtiva("pagas")}
            className={`flex-1 md:flex-none px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${abaAtiva === "pagas" ? "bg-green-600 text-white shadow-md" : "text-zinc-500 hover:text-white"}`}
          >
            Inscrições Pagas {pagas.length > 0 && `(${pagas.length})`}
          </button>
        </div>

        <div className="space-y-4">
          {(abaAtiva === "pendentes" ? pendentes : pagas).length === 0 ? (
            <div className="bg-[#0e0e12] border border-dashed border-white/10 rounded-3xl p-12 text-center">
              <h3 className="text-white font-bold text-lg mb-2">Nenhuma inscrição encontrada aqui.</h3>
              <p className="text-zinc-500 text-sm">Explore os próximos campeonatos e garanta sua vaga.</p>
              <Link href="/" className="inline-block mt-6 bg-white/5 hover:bg-white/10 text-white font-bold text-xs uppercase tracking-widest px-6 py-3 rounded-xl border border-white/10 transition-colors">
                Ver Calendário de Eventos
              </Link>
            </div>
          ) : (
            (abaAtiva === "pendentes" ? pendentes : pagas).map((insc) => (
              <div key={insc.id} className={`bg-[#0e0e12] border rounded-2xl overflow-hidden transition-colors ${abaAtiva === "pendentes" ? "border-red-500/20 hover:border-red-500/40" : "border-green-500/20 hover:border-green-500/40"}`}>
                <div className="flex flex-col md:flex-row">
                  <div className="md:w-48 h-32 md:h-auto bg-zinc-900 relative shrink-0">
                    {insc.eventos?.banner_url ? (
                      <img src={insc.eventos.banner_url} alt="Banner" className="w-full h-full object-cover opacity-80" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-700">Sem Imagem</div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-[#0e0e12] to-transparent"></div>
                  </div>

                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <h3 className="text-white font-black text-lg md:text-xl leading-tight truncate">
                          {insc.eventos?.nome || "Campeonato Desconhecido"}
                        </h3>
                        <span className={`px-2.5 py-1 rounded text-[9px] font-black uppercase tracking-widest shrink-0 border ${abaAtiva === "pendentes" ? "bg-red-500/10 text-red-500 border-red-500/20" : "bg-green-500/10 text-green-500 border-green-500/20"}`}>
                          {abaAtiva === "pendentes" ? "Aguarda Pagamento" : "Confirmado"}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-2 mb-4">
                        <span className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                          {formatarData(insc.eventos?.data_evento)}
                        </span>
                        <span className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                          Atleta: <strong className="text-zinc-200">{insc.atleta}</strong>
                        </span>
                      </div>

                      <div className="bg-black/50 p-3 rounded-xl border border-white/5 mb-4 md:mb-0">
                        <span className="block text-[9px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Categoria Inscrita</span>
                        <span className="text-white text-xs font-bold">{insc.categoria}</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-5 bg-black/20 border-t md:border-t-0 md:border-l border-white/5 flex flex-col justify-center gap-3 shrink-0 md:w-56">
                    {abaAtiva === "pendentes" ? (
                      <>
                        <button
                          onClick={() => iniciarPagamentoMercadoPago(insc)}
                          disabled={processandoPagamento && inscricaoSelecionada?.id === insc.id}
                          className="cursor-pointer w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-widest py-3.5 rounded-xl shadow-[0_0_20px_rgba(5,150,105,0.2)] transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                        >
                          {processandoPagamento && inscricaoSelecionada?.id === insc.id ? "Abrindo..." : "Pagar agora"}
                        </button>
                        <span className="text-center text-zinc-500 text-[9px] font-bold uppercase tracking-widest">
                          Pix, cartão ou boleto via Mercado Pago
                        </span>
                      </>
                    ) : (
                      <>
                        <Link href={`/ingresso/${insc.evento_id}/${insc.user_id}`} className="cursor-pointer w-full bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase tracking-widest py-3.5 rounded-xl shadow-[0_0_20px_rgba(239,68,68,0.2)] transition-colors flex items-center justify-center gap-2 text-center">
                          Ver Passaporte
                        </Link>
                        <Link href={`/evento/${insc.evento_id}/publico`} className="cursor-pointer w-full bg-white/5 hover:bg-white/10 text-white font-bold text-[10px] uppercase tracking-widest py-3 rounded-xl border border-white/5 transition-colors text-center">
                          Checar Chave
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {checkoutAberto && checkoutData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="bg-[#0e0e12] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden shadow-2xl">
            <div className="p-4 md:p-5 border-b border-white/10 flex items-start justify-between gap-4 bg-black/40">
              <div>
                <span className="text-emerald-400 text-[9px] font-black uppercase tracking-widest">Pagamento seguro</span>
                <h2 className="text-white text-lg md:text-xl font-black mt-1">{checkoutData.eventoNome}</h2>
                <p className="text-zinc-500 text-xs mt-1">Total: {formatarMoeda(checkoutData.valorTotal)}</p>
                {checkoutMensagem && (
                  <p className="mt-2 text-[11px] font-bold text-yellow-400">{checkoutMensagem}</p>
                )}
              </div>
              <button onClick={fecharCheckout} className="cursor-pointer text-zinc-400 hover:text-white text-2xl leading-none">×</button>
            </div>

            <div className="p-4 md:p-5 overflow-y-auto max-h-[75vh] bg-white">
              {brickCarregando && (
                <div className="py-10 text-center text-zinc-500 text-xs font-black uppercase tracking-widest">
                  Carregando Mercado Pago...
                </div>
              )}
              <div id="paymentBrick_container" key={checkoutData.preferenceId}></div>
              {checkoutMensagem && (
                <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-700 text-sm font-bold">
                  {checkoutMensagem}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}