"use client";

import Link from "next/link";
import { obterEventoOrganizador } from "@/app/lib/evento-organizador";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Banknote, CheckCircle2, Copy, Mail, RefreshCw, Search, ShieldAlert, WalletCards } from "lucide-react";
import { supabase } from "@/app/lib/supabase";
import { calcularComissaoMarketplace, getPlanoComercial } from "@/app/lib/planos-comerciais";
import ParcelamentoOrganizador from "@/app/admin/_components/ParcelamentoOrganizador";
import MercadoPagoConnectButton from "@/app/admin/_components/MercadoPagoConnectButton";

type EventoResumo = {
  id: string | number;
  nome: string | null;
  data_evento?: string | null;
};

type InscricaoFinanceira = {
  id: string | number;
  user_id: string;
  evento_id: string | number;
  atleta?: string | null;
  equipe?: string | null;
  categoria?: string | null;
  faixa?: string | null;
  peso?: string | number | null;
  absoluto?: boolean | null;
  pagamento_ok?: boolean | null;
  created_at?: string | null;
  valor_inscricao?: string | number | null;
  valor_total?: string | number | null;
  mp_payment_id?: string | null;
  mp_preference_id?: string | null;
  email_ingresso_status?: "pendente" | "enviando" | "enviado" | "erro" | null;
  email_ingresso_destino?: string | null;
  email_ingresso_enviado_em?: string | null;
  email_ingresso_erro?: string | null;
  eventos?: EventoResumo | EventoResumo[] | null;
};

type OrganizadorFinanceiro = {
  plano_comercial?: string | null;
  comissao_percentual?: string | number | null;
  mp_connected_at?: string | null;
  mp_parcelamento_comprador_confirmado?: boolean | null;
};

type StatusPagamento = {
  id?: string | number;
  status?: string;
  status_detail?: string;
  payment_method_id?: string;
  payment_type_id?: string;
};

const filtrosStatus = [
  { id: "todos", label: "Todos" },
  { id: "pagos", label: "Pagos" },
  { id: "pendentes", label: "Pendentes" },
  { id: "sem_mp", label: "Sem ID MP" },
] as const;

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getEvento(inscricao: InscricaoFinanceira) {
  return Array.isArray(inscricao.eventos) ? inscricao.eventos[0] : inscricao.eventos;
}

function formatarMoeda(valor: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor || 0);
}

function formatarData(data?: string | null) {
  if (!data) return "Data a definir";
  if (data.includes("-")) {
    const [ano, mes, dia] = data.slice(0, 10).split("-");
    if (ano && mes && dia) return `${dia}/${mes}/${ano}`;
  }
  return data;
}

function nomeMetodoPagamento(status?: StatusPagamento | null) {
  const metodo = status?.payment_method_id;
  const tipo = status?.payment_type_id;

  if (metodo === "pix" || tipo === "bank_transfer") return "Pix";
  if (tipo === "ticket" || metodo === "bolbradesco") return "Boleto";
  if (tipo === "credit_card") return "Cartao";
  if (tipo === "debit_card") return "Debito";
  if (metodo) return metodo;
  return "Mercado Pago";
}

export default function FinanceiroAdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState("");
  const [organizador, setOrganizador] = useState<OrganizadorFinanceiro | null>(null);
  const [eventos, setEventos] = useState<EventoResumo[]>([]);
  const [inscricoes, setInscricoes] = useState<InscricaoFinanceira[]>([]);
  const [eventoSelecionado, setEventoSelecionado] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState<(typeof filtrosStatus)[number]["id"]>("todos");
  const [busca, setBusca] = useState("");
  const [acaoId, setAcaoId] = useState<string | number | null>(null);
  const [mensagem, setMensagem] = useState("");
  const [statusMp, setStatusMp] = useState<Record<string, StatusPagamento>>({});

  const carregarDados = useCallback(async () => {
    setLoading(true);
    setMensagem("");

    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user?.id;

    if (!userId) {
      router.push("/login-organizador");
      return;
    }
    setCurrentUserId(userId);

    const { data: orgData } = await supabase
      .from("organizadores")
      .select("plano_comercial, comissao_percentual, mp_connected_at, mp_parcelamento_comprador_confirmado")
      .eq("user_id", userId)
      .maybeSingle();

    setOrganizador((orgData || null) as OrganizadorFinanceiro | null);

    const { data: eventosData, error: eventosError } = await supabase
      .from("eventos")
      .select("id, nome, data_evento")
      .eq("organizador_id", userId)
      .order("id", { ascending: false });

    if (eventosError || !eventosData) {
      setEventos([]);
      setInscricoes([]);
      setLoading(false);
      return;
    }

    const eventosNormalizados = eventosData as EventoResumo[];
    setEventos(eventosNormalizados);
    setEventoSelecionado(obterEventoOrganizador(eventosNormalizados) || "todos");

    if (eventosNormalizados.length === 0) {
      setInscricoes([]);
      setLoading(false);
      return;
    }

    const idsEventos = eventosNormalizados.map((evento) => evento.id);
    const { data: inscricoesData, error: inscricoesError } = await supabase
      .from("inscricoes")
      .select(`
        id,
        user_id,
        evento_id,
        atleta,
        equipe,
        categoria,
        faixa,
        peso,
        absoluto,
        pagamento_ok,
        created_at,
        valor_inscricao,
        valor_total,
        mp_payment_id,
        mp_preference_id,
        email_ingresso_status,
        email_ingresso_destino,
        email_ingresso_enviado_em,
        email_ingresso_erro,
        eventos ( id, nome, data_evento )
      `)
      .in("evento_id", idsEventos)
      .order("id", { ascending: false });

    if (!inscricoesError && inscricoesData) {
      setInscricoes(inscricoesData as InscricaoFinanceira[]);
    }

    setLoading(false);
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregarDados();
  }, [carregarDados]);

  const inscricoesFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    return inscricoes.filter((inscricao) => {
      const evento = getEvento(inscricao);
      const matchEvento = eventoSelecionado === "todos" || String(inscricao.evento_id) === eventoSelecionado;
      const matchBusca = !termo || [inscricao.atleta, inscricao.equipe, inscricao.categoria, evento?.nome, inscricao.mp_payment_id]
        .filter(Boolean)
        .some((campo) => String(campo).toLowerCase().includes(termo));
      const matchStatus = filtroStatus === "todos"
        || (filtroStatus === "pagos" && inscricao.pagamento_ok === true)
        || (filtroStatus === "pendentes" && inscricao.pagamento_ok !== true)
        || (filtroStatus === "sem_mp" && !inscricao.mp_payment_id);

      return matchEvento && matchBusca && matchStatus;
    });
  }, [busca, eventoSelecionado, filtroStatus, inscricoes]);

  const resumo = useMemo(() => {
    const plano = organizador?.plano_comercial;
    const totalInscricoes = inscricoesFiltradas.length;
    const pagas = inscricoesFiltradas.filter((item) => item.pagamento_ok).length;
    const pendentes = totalInscricoes - pagas;
    const semIdMp = inscricoesFiltradas.filter((item) => !item.mp_payment_id).length;
    const inscricoesPagas = inscricoesFiltradas.filter((item) => item.pagamento_ok === true);
    const bruto = inscricoesPagas.reduce((acc, item) => acc + numberValue(item.valor_total || item.valor_inscricao), 0);
    const comissao = inscricoesPagas.reduce((acc, item) => {
      const valor = numberValue(item.valor_total || item.valor_inscricao);
      return acc + calcularComissaoMarketplace(valor, plano).comissao;
    }, 0);

    return { totalInscricoes, pagas, pendentes, semIdMp, bruto, comissao, valorOrganizador: Math.max(0, bruto - comissao) };
  }, [inscricoesFiltradas, organizador?.plano_comercial]);

  async function consultarStatus(inscricao: InscricaoFinanceira) {
    if (!inscricao.mp_payment_id) {
      setMensagem("Esta inscricao ainda nao tem ID do Mercado Pago para consulta automatica.");
      return;
    }

    setAcaoId(inscricao.id);
    setMensagem("Consultando pagamento no Mercado Pago...");

    try {
      const response = await fetch("/api/pagamento/mercado-pago/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inscricaoId: inscricao.id, paymentId: inscricao.mp_payment_id }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Falha ao consultar status.");

      const status = data as StatusPagamento;
      setStatusMp((atual) => ({ ...atual, [String(inscricao.id)]: status }));

      if (status.status === "approved") {
        setInscricoes((atual) => atual.map((item) => item.id === inscricao.id ? { ...item, pagamento_ok: true } : item));
        setMensagem("Pagamento aprovado no Mercado Pago. Inscricao liberada no iTatame.");
      } else {
        setMensagem(`Mercado Pago retornou: ${status.status || "status desconhecido"}.`);
      }
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : "Nao foi possivel consultar o pagamento.");
    } finally {
      setAcaoId(null);
    }
  }

  async function reenviarPassaporte(inscricao: InscricaoFinanceira) {
    setAcaoId(inscricao.id);
    setMensagem("Reenviando passaporte por e-mail...");

    try {
      const { data: sessao } = await supabase.auth.getSession();
      const response = await fetch("/api/enviar-ingresso-confirmado", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessao.session?.access_token || ""}`,
        },
        body: JSON.stringify({ inscricaoId: inscricao.id }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Falha ao reenviar passaporte.");

      setInscricoes((atual) => atual.map((item) => item.id === inscricao.id ? {
        ...item,
        email_ingresso_status: "enviado",
        email_ingresso_enviado_em: new Date().toISOString(),
      } : item));
      setMensagem("Passaporte reenviado e entrega registrada.");
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : "Nao foi possivel reenviar o passaporte.");
    } finally {
      setAcaoId(null);
    }
  }

  function copiar(texto?: string | null) {
    if (!texto) return;
    navigator.clipboard.writeText(texto);
    setMensagem("Copiado para a area de transferencia.");
  }

  const planoAtual = getPlanoComercial(organizador?.plano_comercial);
  const mercadoPagoConectado = Boolean(organizador?.mp_connected_at);

  return (
    <main className="min-h-screen bg-[#050505] text-white p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 border-b border-white/10 pb-6">
          <div>
            <Link href="/admin" className="inline-flex items-center gap-2 text-zinc-500 hover:text-white text-[10px] font-black uppercase tracking-widest mb-3">
              <ArrowLeft size={14} /> Voltar ao painel
            </Link>
            <h1 className="text-2xl md:text-4xl font-black tracking-tight">Auditoria Financeira</h1>
            <p className="text-zinc-500 text-sm mt-2 max-w-2xl">Acompanhe inscricoes, status Mercado Pago, pendencias de liberacao e reenvio de passaportes.</p>
          </div>

          <button onClick={carregarDados} disabled={loading} className="cursor-pointer bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Atualizar
          </button>
        </div>

        <section className="bg-black/40 border border-white/5 rounded-2xl p-4 md:p-5 mb-6 shadow-xl">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div>
              <span className="text-emerald-400 text-[9px] font-black uppercase tracking-widest">Configuração financeira</span>
              <h2 className="text-lg md:text-xl font-black text-white mt-1">Plano e recebimento</h2>
              <p className="text-zinc-500 text-xs mt-1 max-w-2xl">Gerencie aqui a conta que recebe as inscrições e as condições de parcelamento.</p>
            </div>
            <MercadoPagoConnectButton conectado={mercadoPagoConectado} returnTo="/admin/financeiro" className={`rounded-xl px-5 py-3 text-[10px] font-black uppercase tracking-widest border transition-all ${mercadoPagoConectado ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20" : "bg-yellow-500 text-black border-yellow-400 hover:bg-yellow-400"}`} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
            <div className="rounded-xl border border-white/10 bg-[#050505] px-4 py-3">
              <span className="block text-zinc-500 text-[9px] font-black uppercase tracking-widest">Plano atual</span>
              <strong className="block text-white text-sm mt-1">{planoAtual.nome}</strong>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#050505] px-4 py-3">
              <span className="block text-zinc-500 text-[9px] font-black uppercase tracking-widest">Comissão iTatame</span>
              <strong className="block text-white text-sm mt-1">{planoAtual.comissaoPercentual}% por inscrição</strong>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#050505] px-4 py-3">
              <span className="block text-zinc-500 text-[9px] font-black uppercase tracking-widest">Parcelamento</span>
              <strong className={`block text-sm mt-1 ${organizador?.mp_parcelamento_comprador_confirmado ? "text-emerald-400" : "text-yellow-400"}`}>
                {organizador?.mp_parcelamento_comprador_confirmado ? "Até 12x · juros do atleta" : "Somente 1x"}
              </strong>
            </div>
          </div>

          <ParcelamentoOrganizador
            key={currentUserId + String(organizador?.mp_parcelamento_comprador_confirmado)}
            confirmado={organizador?.mp_parcelamento_comprador_confirmado === true}
            inicialConectado={mercadoPagoConectado}
          />
        </section>

        <section className="mb-4 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4">
          <h2 className="text-sm font-black text-white">Como ler o financeiro</h2>
          <div className="mt-3 grid gap-3 text-xs text-zinc-400 md:grid-cols-3">
            <p><strong className="block text-zinc-200 mb-1">1. Arrecadado</strong>Soma somente inscrições com pagamento aprovado.</p>
            <p><strong className="block text-zinc-200 mb-1">2. Comissão iTatame</strong>Percentual do plano aplicado sobre as inscrições pagas.</p>
            <p><strong className="block text-zinc-200 mb-1">3. Valor do organizador</strong>Arrecadado menos a comissão iTatame. A tarifa de processamento do Mercado Pago aparece na conta Mercado Pago.</p>
          </div>
        </section>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
          <div className="bg-black/40 border border-white/5 rounded-2xl p-4">
            <span className="text-zinc-500 text-[9px] font-black uppercase tracking-widest">Inscricoes</span>
            <strong className="block text-2xl font-black mt-2">{resumo.totalInscricoes}</strong>
          </div>
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4">
            <span className="text-emerald-400 text-[9px] font-black uppercase tracking-widest">Pagas</span>
            <strong className="block text-2xl font-black mt-2 text-emerald-400">{resumo.pagas}</strong>
          </div>
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4">
            <span className="text-red-400 text-[9px] font-black uppercase tracking-widest">Pendentes</span>
            <strong className="block text-2xl font-black mt-2 text-red-400">{resumo.pendentes}</strong>
          </div>
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-4">
            <span className="text-yellow-400 text-[9px] font-black uppercase tracking-widest">Sem ID MP</span>
            <strong className="block text-2xl font-black mt-2 text-yellow-400">{resumo.semIdMp}</strong>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4">
            <span className="text-emerald-400 text-[9px] font-black uppercase tracking-widest">Arrecadado aprovado</span>
            <strong className="block text-xl font-black mt-2 text-emerald-300">{formatarMoeda(resumo.bruto)}</strong>
          </div>
          <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-2xl p-4">
            <span className="text-cyan-400 text-[9px] font-black uppercase tracking-widest">Comissão iTatame</span>
            <strong className="block text-xl font-black mt-2 text-cyan-300">{formatarMoeda(resumo.comissao)}</strong>
          </div>
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-4">
            <span className="text-yellow-400 text-[9px] font-black uppercase tracking-widest">Organizador antes da tarifa MP</span>
            <strong className="block text-xl font-black mt-2 text-yellow-200">{formatarMoeda(resumo.valorOrganizador)}</strong>
          </div>
        </div>

        <section className="bg-black/40 border border-white/5 rounded-2xl p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <label className="md:col-span-5 flex items-center gap-3 bg-[#050505] border border-white/10 rounded-xl px-3 py-2.5">
              <Search size={16} className="text-zinc-600" />
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar atleta, equipe, evento ou ID MP" className="w-full bg-transparent outline-none text-sm text-white placeholder:text-zinc-700" />
            </label>

            <select value={eventoSelecionado} onChange={(e) => setEventoSelecionado(e.target.value)} className="md:col-span-4 bg-[#050505] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none">
              <option value="todos">Todos os eventos</option>
              {eventos.map((evento) => (
                <option key={String(evento.id)} value={String(evento.id)}>{evento.nome || `Evento ${evento.id}`}</option>
              ))}
            </select>

            <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value as (typeof filtrosStatus)[number]["id"])} className="md:col-span-3 bg-[#050505] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none">
              {filtrosStatus.map((filtro) => <option key={filtro.id} value={filtro.id}>{filtro.label}</option>)}
            </select>
          </div>

          {mensagem && (
            <div className="mt-3 rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-cyan-200 text-sm font-bold">
              {mensagem}
            </div>
          )}
        </section>

        <section className="bg-black/40 border border-white/5 rounded-2xl overflow-hidden">
          <div className="hidden lg:grid grid-cols-[1.4fr_1fr_0.85fr_0.8fr_1.2fr] gap-3 px-4 py-3 border-b border-white/5 text-[10px] font-black uppercase tracking-widest text-zinc-500">
            <span>Atleta / Evento</span>
            <span>Categoria</span>
            <span>Valor</span>
            <span>Status</span>
            <span>Acoes</span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-zinc-500 text-xs font-black uppercase tracking-widest">Carregando financeiro...</div>
          ) : inscricoesFiltradas.length === 0 ? (
            <div className="p-12 text-center text-zinc-500 text-xs font-black uppercase tracking-widest">Nenhuma inscricao encontrada.</div>
          ) : (
            <div className="divide-y divide-white/5">
              {inscricoesFiltradas.map((inscricao) => {
                const evento = getEvento(inscricao);
                const valor = numberValue(inscricao.valor_total || inscricao.valor_inscricao);
                const calculo = calcularComissaoMarketplace(valor, organizador?.plano_comercial);
                const statusAtual = statusMp[String(inscricao.id)];
                const pago = inscricao.pagamento_ok === true;

                return (
                  <article key={String(inscricao.id)} className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr_0.85fr_0.8fr_1.2fr] gap-3 p-4 items-center hover:bg-white/[0.02] transition-colors">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`w-2.5 h-2.5 rounded-full ${pago ? "bg-emerald-500" : "bg-red-500"}`}></span>
                        <h3 className="font-black text-white text-sm truncate">{inscricao.atleta || "Atleta sem nome"}</h3>
                      </div>
                      <p className="text-zinc-500 text-xs truncate">{evento?.nome || "Evento sem nome"} - {formatarData(evento?.data_evento)}</p>
                      <div className="mt-2 flex items-center gap-2 text-[10px] text-zinc-600 font-bold uppercase tracking-widest">
                        <button type="button" onClick={() => copiar(String(inscricao.id))} className="hover:text-white inline-flex items-center gap-1"><Copy size={12} /> INS {inscricao.id}</button>
                        {inscricao.mp_payment_id && <button type="button" onClick={() => copiar(inscricao.mp_payment_id)} className="hover:text-white inline-flex items-center gap-1"><WalletCards size={12} /> MP {inscricao.mp_payment_id}</button>}
                      </div>
                    </div>

                    <div>
                      <span className="lg:hidden block text-[9px] text-zinc-600 font-black uppercase tracking-widest mb-1">Categoria</span>
                      <p className="text-sm text-white font-bold">{inscricao.categoria || "Categoria nao informada"}</p>
                      <p className="text-xs text-zinc-500 mt-1">{inscricao.equipe || "Sem equipe"}</p>
                    </div>

                    <div>
                      <span className="lg:hidden block text-[9px] text-zinc-600 font-black uppercase tracking-widest mb-1">Valor</span>
                      <p className="text-sm font-black text-white">{valor ? formatarMoeda(valor) : "A calcular"}</p>
                      <p className="text-[10px] text-cyan-300 font-bold mt-1">iTatame: {valor ? formatarMoeda(calculo.comissao) : "-"}</p>
                    </div>

                    <div>
                      <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest border ${pago ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"}`}>
                        {pago ? <CheckCircle2 size={13} /> : <ShieldAlert size={13} />}
                        {pago ? "Pago" : "Pendente"}
                      </span>
                      {statusAtual && <p className="mt-2 text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{nomeMetodoPagamento(statusAtual)} - {statusAtual.status}</p>}
                      {!inscricao.mp_payment_id && <p className="mt-2 text-[10px] text-yellow-400 font-bold uppercase tracking-widest">Sem ID Mercado Pago</p>}
                      {pago && <p className={`mt-2 text-[10px] font-bold uppercase tracking-widest ${inscricao.email_ingresso_status === "enviado" ? "text-emerald-400" : inscricao.email_ingresso_status === "erro" ? "text-red-400" : "text-yellow-400"}`} title={inscricao.email_ingresso_erro || undefined}>
                        E-mail: {inscricao.email_ingresso_status === "enviado" ? "enviado" : inscricao.email_ingresso_status === "erro" ? "falhou" : "pendente"}
                      </p>}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button onClick={() => consultarStatus(inscricao)} disabled={!inscricao.mp_payment_id || acaoId === inscricao.id} className="cursor-pointer rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-2.5 text-[10px] font-black uppercase tracking-widest disabled:opacity-40 flex items-center justify-center gap-2">
                        <RefreshCw size={13} className={acaoId === inscricao.id ? "animate-spin" : ""} /> Consultar
                      </button>
                      <button onClick={() => reenviarPassaporte(inscricao)} disabled={!pago || acaoId === inscricao.id} className="cursor-pointer rounded-lg bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-500/20 text-emerald-300 px-3 py-2.5 text-[10px] font-black uppercase tracking-widest disabled:opacity-40 flex items-center justify-center gap-2">
                        <Mail size={13} /> Reenviar
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <div className="mt-5 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-yellow-100 text-xs leading-relaxed flex gap-3">
          <Banknote size={18} className="shrink-0 text-yellow-400" />
          <p>
            Valores antigos podem aparecer como &quot;A calcular&quot; se a inscricao foi criada antes da gravacao de valor financeiro. Novas cobrancas gravam o valor para melhorar esta auditoria.
          </p>
        </div>
      </div>
    </main>
  );
}
