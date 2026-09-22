"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, AlertTriangle, Banknote, ChevronDown, FileText, Globe, Scale, Search, ShieldCheck, Users } from "lucide-react";
import { supabase } from "@/app/lib/supabase";
import { baixarCsv, exportarPdfRetratt, exportarPdfSuporte } from "@/app/lib/super-admin-relatorio";
import {
  buscarPaginas,
  dataCurta,
  eventoEmbutido,
  indiceOrganizadores,
  itemResumoDaInscricao,
  moeda,
  montarLinhaSuporte,
  resumirItatame,
  situacaoInscricao,
  whatsappDe,
  type EventoPainel,
  type InscricaoPainel,
  type OrganizadorPainel,
  type SituacaoInscricao,
} from "@/app/lib/super-admin-painel";

type Sistema = "itatame" | "retratt";

type ResumoRetratt = {
  faturamentoCentavos: number;
  comissaoItatameCentavos: number;
  royaltyEmAbertoCentavos: number;
  royaltyDisponivelCentavos: number;
  royaltyPagoCentavos: number;
  pedidosPagos: number;
  fotosVendidas: number;
};

type FinanceiroRetratt = {
  geral: ResumoRetratt & { ticketMedioCentavos: number; galerias: number; organizadores: number; fotografos: number };
  organizadores: Array<ResumoRetratt & { id: string; nome: string; galerias: number }>;
  pedidosRecentes: Array<{
    id: string;
    data: string;
    galeria: string;
    fotografo: string;
    organizador: string;
    totalCentavos: number;
    comissaoItatameCentavos: number;
    royaltyCentavos: number;
    repasseStatus: string;
    fotos: number;
  }>;
};

const rotuloRepasse: Record<string, string> = {
  pendente: "Pendente",
  aguardando_liberacao: "Aguardando liberação",
  disponivel: "Disponível",
  pago: "Pago",
  estornado: "Estornado",
  nao_aplicavel: "Sem royalty",
};

function centavos(valor?: number | null) {
  return moeda((valor || 0) / 100);
}

export default function SuperAdminMasterPage() {
  const router = useRouter();
  const [nomeDono, setNomeDono] = useState("Mestre");
  const [fotoUrl, setFotoUrl] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [sistema, setSistema] = useState<Sistema>("itatame");
  const [organizadores, setOrganizadores] = useState<OrganizadorPainel[]>([]);
  const [eventos, setEventos] = useState<EventoPainel[]>([]);
  const [inscricoes, setInscricoes] = useState<InscricaoPainel[]>([]);
  const [retratt, setRetratt] = useState<FinanceiroRetratt | null>(null);
  const [erroRetratt, setErroRetratt] = useState("");
  const [carregandoRetratt, setCarregandoRetratt] = useState(true);
  const [busca, setBusca] = useState("");
  const [organizadorId, setOrganizadorId] = useState("");
  const [eventoId, setEventoId] = useState("");
  const [faixa, setFaixa] = useState("");
  const [situacao, setSituacao] = useState<"todos" | SituacaoInscricao>("todos");
  const [semIdMp, setSemIdMp] = useState(false);
  const [limite, setLimite] = useState(80);
  const [buscaRetratt, setBuscaRetratt] = useState("");
  const [showRegrasModal, setShowRegrasModal] = useState(false);
  const [novaRegra, setNovaRegra] = useState({ tipo: "peso", nome: "", genero: "Masculino" });

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        router.push("/login-organizador");
        return;
      }
      const [{ data: perfil }, { data: atleta }] = await Promise.all([
        supabase.from("perfis").select("nome").eq("id", authData.user.id).maybeSingle(),
        supabase.from("atletas").select("foto_url").eq("user_id", authData.user.id).maybeSingle(),
      ]);
      if (!ativo) return;
      if (perfil?.nome) setNomeDono(perfil.nome.split(" ")[0]);
      if (atleta?.foto_url) setFotoUrl(atleta.foto_url);

      try {
        const [listaOrganizadores, listaEventos, listaInscricoes] = await Promise.all([
          buscarPaginas<OrganizadorPainel>(async (inicio, fim) => {
            const resultado = await supabase
              .from("organizadores")
              .select("id, user_id, nome, academia, email, telefone, foto_url, status, plano_comercial, comissao_percentual, mp_connected_at, cidade, estado, documento, created_at")
              .order("created_at", { ascending: false })
              .range(inicio, fim);
            return { data: resultado.data as OrganizadorPainel[] | null, error: resultado.error };
          }),
          buscarPaginas<EventoPainel>(async (inicio, fim) => {
            const resultado = await supabase
              .from("eventos")
              .select("id, nome, data_evento, data_fim_inscricoes, organizador_id, cidade, estado, local")
              .order("data_evento", { ascending: false })
              .range(inicio, fim);
            return { data: resultado.data as EventoPainel[] | null, error: resultado.error };
          }),
          buscarPaginas<InscricaoPainel>(async (inicio, fim) => {
            const resultado = await supabase
              .from("inscricoes")
              .select("id, atleta, equipe, categoria, faixa, peso, idade, absoluto, pagamento_ok, pesagem_ok, valor_inscricao, valor_total, mp_payment_id, estorno_status, estorno_valor, created_at, evento_id, eventos(nome, organizador_id, data_evento, cidade)")
              .order("id", { ascending: false })
              .range(inicio, fim);
            return { data: resultado.data as InscricaoPainel[] | null, error: resultado.error };
          }),
        ]);
        if (!ativo) return;
        setOrganizadores(listaOrganizadores);
        setEventos(listaEventos);
        setInscricoes(listaInscricoes);
      } catch (falha) {
        if (ativo) setErro(falha instanceof Error ? falha.message : "Não foi possível carregar o Itatame.");
      } finally {
        if (ativo) setCarregando(false);
      }
    }
    void carregar();
    return () => {
      ativo = false;
    };
  }, [router]);

  useEffect(() => {
    let ativo = true;
    async function carregarRetratt() {
      const { data: sessao } = await supabase.auth.getSession();
      const token = sessao.session?.access_token;
      if (!token) {
        if (ativo) {
          setErroRetratt("Sessão expirada para consultar a Retratt.");
          setCarregandoRetratt(false);
        }
        return;
      }
      try {
        const response = await fetch("/api/super-admin/fotos-financeiro", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const resultado = await response.json();
        if (!response.ok) throw new Error(resultado.error || "Falha ao carregar a Retratt.");
        if (ativo) setRetratt(resultado);
      } catch (falha) {
        if (ativo) setErroRetratt(falha instanceof Error ? falha.message : "Falha ao carregar a Retratt.");
      } finally {
        if (ativo) setCarregandoRetratt(false);
      }
    }
    void carregarRetratt();
    return () => {
      ativo = false;
    };
  }, []);

  const organizadoresPorUsuario = useMemo(() => indiceOrganizadores(organizadores), [organizadores]);
  const eventosPorId = useMemo(() => new Map(eventos.map((evento) => [String(evento.id), evento])), [eventos]);
  const resumoItatame = useMemo(
    () => resumirItatame(inscricoes.map((item) => itemResumoDaInscricao(item, organizadoresPorUsuario))),
    [inscricoes, organizadoresPorUsuario],
  );

  const fila = organizadores.filter((item) => item.status === "pendente").length;
  const aprovados = organizadores.filter((item) => item.status === "aprovado");
  const semMercadoPago = aprovados.filter((item) => !item.mp_connected_at).length;

  const faixas = useMemo(
    () => Array.from(new Set(inscricoes.map((item) => item.faixa).filter(Boolean))) as string[],
    [inscricoes],
  );

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return inscricoes.filter((item) => {
      const evento = item.evento_id != null ? eventosPorId.get(String(item.evento_id)) : undefined;
      const embutido = eventoEmbutido(item);
      const userId = evento?.organizador_id || embutido?.organizador_id || "";
      const organizador = organizadoresPorUsuario.get(userId);
      if (organizadorId && userId !== organizadorId) return false;
      if (eventoId && String(item.evento_id) !== eventoId) return false;
      if (faixa && item.faixa !== faixa) return false;
      const atual = situacaoInscricao(item);
      if (situacao !== "todos" && atual !== situacao) return false;
      if (semIdMp && (atual !== "pago" || Boolean(item.mp_payment_id))) return false;
      if (!termo) return true;
      return [item.atleta, item.equipe, item.categoria, item.mp_payment_id, organizador?.nome, organizador?.academia, organizador?.email, evento?.nome, embutido?.nome]
        .join(" ")
        .toLowerCase()
        .includes(termo);
    });
  }, [busca, eventoId, eventosPorId, faixa, inscricoes, organizadorId, organizadoresPorUsuario, semIdMp, situacao]);

  const resumoFiltrado = useMemo(
    () => resumirItatame(filtradas.map((item) => itemResumoDaInscricao(item, organizadoresPorUsuario))),
    [filtradas, organizadoresPorUsuario],
  );

  const retrattFiltrado = useMemo(() => {
    const termo = buscaRetratt.trim().toLowerCase();
    return (retratt?.organizadores || []).filter((item) => !termo || item.nome.toLowerCase().includes(termo));
  }, [buscaRetratt, retratt]);

  function linhaDaInscricao(item: InscricaoPainel) {
    const evento = item.evento_id != null ? eventosPorId.get(String(item.evento_id)) : undefined;
    const userId = evento?.organizador_id || eventoEmbutido(item)?.organizador_id || "";
    return montarLinhaSuporte(item, organizadoresPorUsuario.get(userId), evento);
  }

  function exportarItatame(formato: "pdf" | "csv") {
    if (filtradas.length === 0) {
      alert("Nenhuma inscrição do Itatame neste filtro.");
      return;
    }
    const linhas = filtradas.map(linhaDaInscricao);
    const hoje = new Date().toLocaleString("pt-BR");
    if (formato === "csv") {
      baixarCsv(
        `itatame-suporte-${new Date().toISOString().slice(0, 10)}.csv`,
        ["Organizador", "Academia", "Contato", "Plano", "Mercado Pago", "Evento", "Data", "Atleta", "Equipe", "Categoria", "Faixa", "Peso", "Pacote", "Valor", "Pagamento", "Pesagem", "ID Mercado Pago"],
        linhas.map((linha) => [linha.organizador, linha.academia, linha.contato, linha.plano, linha.mercadoPago, linha.evento, linha.dataEvento, linha.atleta, linha.equipe, linha.categoria, linha.faixa, linha.peso, linha.pacote, linha.valor, linha.pagamento, linha.pesagem, linha.mercadoPagoId]),
      );
      return;
    }
    exportarPdfSuporte({
      titulo: "Itatame — ficha de suporte",
      subtitulo: `Gerado em ${hoje}. ${filtradas.length} inscrições no filtro atual. Valores da Retratt não entram neste relatório.`,
      resumo: [
        ["Faturamento pago", moeda(resumoFiltrado.faturamento)],
        ["Comissão da plataforma", moeda(resumoFiltrado.comissao)],
        ["Repasse dos organizadores", moeda(resumoFiltrado.repasse)],
        ["Aguardando pagamento", moeda(resumoFiltrado.pendente)],
        ["Estornado", moeda(resumoFiltrado.estornado)],
        ["Pagas", String(resumoFiltrado.pagos)],
        ["Pendentes", String(resumoFiltrado.pendentes)],
        ["Estornos", String(resumoFiltrado.estornos)],
      ],
      linhas,
      nomeArquivo: `itatame-suporte-${new Date().toISOString().slice(0, 10)}.pdf`,
    });
  }

  function exportarRetratt() {
    if (!retratt || retrattFiltrado.length === 0) {
      alert("Nenhum organizador da Retratt neste filtro.");
      return;
    }
    exportarPdfRetratt({
      subtitulo: `Gerado em ${new Date().toLocaleString("pt-BR")}. Somente pedidos pagos de foto. Inscrições de campeonato ficam no relatório do Itatame.`,
      resumo: [
        ["Vendas pagas", centavos(retratt.geral.faturamentoCentavos)],
        ["Comissão Itatame", centavos(retratt.geral.comissaoItatameCentavos)],
        ["Royalty em aberto", centavos(retratt.geral.royaltyEmAbertoCentavos)],
        ["Fotos vendidas", String(retratt.geral.fotosVendidas)],
      ],
      linhas: retrattFiltrado.map((item) => ({
        organizador: item.nome,
        galerias: String(item.galerias),
        vendas: centavos(item.faturamentoCentavos),
        comissao: centavos(item.comissaoItatameCentavos),
        royaltyAberto: centavos(item.royaltyEmAbertoCentavos),
        royaltyDisponivel: centavos(item.royaltyDisponivelCentavos),
        royaltyPago: centavos(item.royaltyPagoCentavos),
      })),
      nomeArquivo: `retratt-financeiro-${new Date().toISOString().slice(0, 10)}.pdf`,
    });
  }

  if (carregando) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#050505] text-xs font-black uppercase tracking-widest text-indigo-400">
        <Activity className="mb-4 h-10 w-10 animate-pulse" />
        Separando Itatame e Retratt...
      </div>
    );
  }

  const visiveis = filtradas.slice(0, limite);

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#050505] p-4 text-white md:p-6 lg:p-8">
      <div className="pointer-events-none absolute right-0 top-0 h-[520px] w-[520px] rounded-full bg-indigo-900/15 blur-[150px]" />
      <div className="relative mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div className="flex items-center gap-4">
              {fotoUrl ? (
              <img src={fotoUrl} alt="" className="h-16 w-16 rounded-full border-2 border-indigo-500/50 object-cover md:h-20 md:w-20" />
              ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-zinc-900 text-zinc-500 md:h-20 md:w-20">
                <ShieldCheck className="h-8 w-8" />
                </div>
              )}
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest">
                  <Globe size={12} /> Super Admin
                </span>
                <span className="text-[9px] font-bold uppercase tracking-widest text-green-400">Sistemas separados</span>
              </div>
              <h1 className="text-3xl font-black tracking-tight md:text-5xl">QG de suporte</h1>
              <p className="mt-1 max-w-xl text-sm text-zinc-400">
                {nomeDono}, o Itatame e a Retratt ficam em caixas diferentes. O dinheiro de campeonato não entra no de foto.
              </p>
            </div>
          </div>
          <button
            onClick={() => supabase.auth.signOut().then(() => router.push("/"))}
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest"
          >
            Encerrar sessão
          </button>
        </header>

        <div className="mb-6 grid gap-3 md:grid-cols-2">
          <button
            type="button"
            onClick={() => setSistema("itatame")}
            className={`rounded-3xl border p-5 text-left transition ${sistema === "itatame" ? "border-red-500/60 bg-red-500/10" : "border-white/10 bg-[#0a0a0e] hover:border-white/20"}`}
          >
            <p className="text-[10px] font-black uppercase tracking-widest text-red-400">Sistema Itatame</p>
            <p className="mt-2 text-2xl font-black">{moeda(resumoItatame.faturamento)}</p>
            <p className="mt-1 text-xs text-zinc-400">Inscrições pagas · comissão {moeda(resumoItatame.comissao)} · {eventos.length} campeonatos · {aprovados.length} organizadores</p>
          </button>
          <button
            type="button"
            onClick={() => setSistema("retratt")}
            className={`rounded-3xl border p-5 text-left transition ${sistema === "retratt" ? "border-cyan-500/60 bg-cyan-500/10" : "border-white/10 bg-[#0a0a0e] hover:border-white/20"}`}
          >
            <p className="text-[10px] font-black uppercase tracking-widest text-cyan-400">Sistema Retratt</p>
            <p className="mt-2 text-2xl font-black">{carregandoRetratt ? "..." : centavos(retratt?.geral.faturamentoCentavos)}</p>
            <p className="mt-1 text-xs text-zinc-400">
              {carregandoRetratt ? "Consolidando vendas de foto..." : `${retratt?.geral.pedidosPagos || 0} pedidos pagos · ${retratt?.geral.galerias || 0} galerias · royalty aberto ${centavos(retratt?.geral.royaltyEmAbertoCentavos)}`}
            </p>
            </button>
        </div>

        {sistema === "itatame" ? (
          <section>
            {erro && <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{erro}</p>}
            <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <article className="rounded-2xl border border-red-500/30 bg-[#0a0a0e] p-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-red-300">Faturamento Itatame</p>
                <p className="mt-2 text-xl font-black md:text-2xl">{moeda(resumoItatame.faturamento)}</p>
                <p className="mt-1 text-[10px] text-zinc-500">{resumoItatame.pagos} pagas · repasse {moeda(resumoItatame.repasse)}</p>
              </article>
              <article className="rounded-2xl border border-white/10 bg-[#0a0a0e] p-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Comissão da plataforma</p>
                <p className="mt-2 text-xl font-black md:text-2xl">{moeda(resumoItatame.comissao)}</p>
                <p className="mt-1 text-[10px] text-zinc-500">Pelo plano de cada organizador</p>
              </article>
              <article className="rounded-2xl border border-white/10 bg-[#0a0a0e] p-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Em aberto</p>
                <p className="mt-2 text-xl font-black md:text-2xl">{moeda(resumoItatame.pendente)}</p>
                <p className="mt-1 text-[10px] text-zinc-500">{resumoItatame.pendentes} pendentes · {moeda(resumoItatame.estornado)} estornado</p>
              </article>
              <article className="rounded-2xl border border-white/10 bg-[#0a0a0e] p-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Organizadores</p>
                <p className="mt-2 text-xl font-black md:text-2xl">{aprovados.length}</p>
                <p className="mt-1 text-[10px] text-zinc-500">{fila} na fila · {semMercadoPago} sem Mercado Pago</p>
              </article>
            </div>

            <div className="mb-6 grid gap-3 md:grid-cols-4">
              <Link href="/super-admin/suporte" className="rounded-2xl border border-yellow-500/40 bg-yellow-500/10 p-5 transition hover:border-yellow-400">
                <Users className="mb-3 text-yellow-400" size={20} />
                <h2 className="font-black">Acessar painel comum</h2>
                <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">Visão detalhada da tela de cada organizador, para o suporte atender qualquer conta.</p>
              </Link>
              <Link href="/super-admin/organizadores" className="rounded-2xl border border-white/10 bg-[#0a0a0e] p-5 transition hover:border-indigo-500/50">
                <ShieldCheck className="mb-3 text-indigo-400" size={20} />
                <h2 className="font-black">Homologação</h2>
                <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">{fila} conta(s) aguardando análise de acesso.</p>
              </Link>
              <Link href="/super-admin/inscricoes" className="rounded-2xl border border-white/10 bg-[#0a0a0e] p-5 transition hover:border-red-500/50">
                <Banknote className="mb-3 text-red-400" size={20} />
                <h2 className="font-black">Estornos Itatame</h2>
                <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">Devolução de inscrição de campeonato, separada do reembolso de foto.</p>
          </Link>
              <button type="button" onClick={() => setShowRegrasModal(true)} className="rounded-2xl border border-white/10 bg-[#0a0a0e] p-5 text-left transition hover:border-blue-500/50">
                <Scale className="mb-3 text-blue-400" size={20} />
                <h2 className="font-black">Livro de regras</h2>
                <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">Pesos, faixas e idades usados nos campeonatos.</p>
          </button>
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => { setSituacao("pendente"); setSemIdMp(false); }} className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-yellow-200">
                {resumoItatame.pendentes} pagamentos pendentes
              </button>
              <button type="button" onClick={() => { setSituacao("pago"); setSemIdMp(true); }} className="rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-orange-200">
                <AlertTriangle size={12} className="mr-1 inline" /> Pagas sem ID Mercado Pago
              </button>
              <button type="button" onClick={() => { setSituacao("estornado"); setSemIdMp(false); }} className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-red-200">
                {resumoItatame.estornos} estornos
              </button>
              <button type="button" onClick={() => { setSituacao("todos"); setSemIdMp(false); setOrganizadorId(""); setEventoId(""); setFaixa(""); setBusca(""); }} className="rounded-full border border-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                Limpar filtros
              </button>
          </div>

            <div className="rounded-3xl border border-white/10 bg-[#0a0a0e]/90 p-5">
              <div className="mb-5 flex flex-col justify-between gap-3 border-b border-white/5 pb-4 md:flex-row md:items-center">
                <div>
                  <h2 className="text-lg font-black">Lista de suporte · Itatame</h2>
                  <p className="mt-1 text-xs text-zinc-500">
                    {filtradas.length} inscrições · pago {moeda(resumoFiltrado.faturamento)} · pendente {moeda(resumoFiltrado.pendente)}
                  </p>
            </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => exportarItatame("csv")} className="rounded-lg border border-white/10 px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-zinc-300">CSV</button>
                  <button type="button" onClick={() => exportarItatame("pdf")} className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-red-300">
                    <FileText size={13} /> PDF de suporte
                  </button>
            </div>
            </div>

              <div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <label className="relative xl:col-span-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={15} />
                  <input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Atleta, equipe, organizador, e-mail ou ID MP" className="w-full rounded-xl border border-white/10 bg-black py-2.5 pl-9 pr-3 text-xs outline-none focus:border-red-500" />
                </label>
                <SelectFiltro value={organizadorId} onChange={setOrganizadorId} placeholder="Todos os organizadores">
                  {Array.from(organizadoresPorUsuario.values())
                    .sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"))
                    .map((item) => (
                      <option key={item.user_id} value={item.user_id || ""}>{item.nome || "Sem nome"} · {item.academia || item.status}</option>
                    ))}
                </SelectFiltro>
                <SelectFiltro value={eventoId} onChange={setEventoId} placeholder="Todos os campeonatos">
                  {eventos.map((evento) => <option key={evento.id} value={String(evento.id)}>{evento.nome}</option>)}
                </SelectFiltro>
                <SelectFiltro value={situacao} onChange={(valor) => setSituacao(valor as "todos" | SituacaoInscricao)} placeholder="">
                  <option value="todos">Pagamento: todos</option>
                  <option value="pago">Somente pagos</option>
                  <option value="pendente">Somente pendentes</option>
                  <option value="estornado">Somente estornados</option>
                </SelectFiltro>
            </div>
              <div className="mb-5 max-w-xs">
                <SelectFiltro value={faixa} onChange={setFaixa} placeholder="Todas as faixas">
                  {faixas.map((item) => <option key={item} value={item}>{item}</option>)}
                </SelectFiltro>
          </div>

              <div className="overflow-x-auto rounded-2xl border border-white/5">
                <table className="w-full min-w-[980px] text-left text-xs">
                  <thead className="bg-black text-[9px] uppercase tracking-widest text-zinc-500">
                    <tr>
                      <th className="p-3">Organizador</th>
                      <th className="p-3">Atleta</th>
                      <th className="p-3">Campeonato</th>
                      <th className="p-3">Chave</th>
                      <th className="p-3">Valor</th>
                      <th className="p-3">Situação</th>
                      <th className="p-3">Suporte</th>
                  </tr>
                </thead>
                  <tbody>
                    {visiveis.length === 0 ? (
                      <tr><td colSpan={7} className="p-10 text-center text-[10px] font-bold uppercase tracking-widest text-zinc-500">Nenhuma inscrição do Itatame neste filtro.</td></tr>
                    ) : visiveis.map((item) => {
                      const linha = linhaDaInscricao(item);
                      const evento = item.evento_id != null ? eventosPorId.get(String(item.evento_id)) : undefined;
                      const userId = evento?.organizador_id || eventoEmbutido(item)?.organizador_id || "";
                      const organizador = organizadoresPorUsuario.get(userId);
                      const zap = whatsappDe(organizador?.telefone);
                      const situacaoAtual = situacaoInscricao(item);
                      return (
                        <tr key={item.id} className="border-t border-white/5 align-top">
                          <td className="p-3">
                            <p className="font-bold text-white">{linha.organizador}</p>
                            <p className="text-[10px] text-zinc-500">{linha.academia}</p>
                            <p className="text-[10px] text-zinc-600">{linha.plano}</p>
                          </td>
                          <td className="p-3">
                            <p className="font-bold">{linha.atleta}</p>
                            <p className="text-[10px] text-zinc-500">{linha.equipe}</p>
                          </td>
                          <td className="p-3">
                            <p>{linha.evento}</p>
                            <p className="text-[10px] text-zinc-500">{linha.dataEvento}{evento?.cidade ? ` · ${evento.cidade}` : ""}</p>
                        </td>
                          <td className="p-3">
                            <p>{linha.categoria}</p>
                            <p className="text-[10px] text-zinc-500">{linha.faixa} · {linha.peso} · {linha.pacote}</p>
                        </td>
                          <td className="p-3 font-bold">{linha.valor}</td>
                          <td className="p-3">
                            <p className={situacaoAtual === "pago" ? "text-emerald-400" : situacaoAtual === "estornado" ? "text-red-400" : "text-yellow-300"}>{linha.pagamento}</p>
                            <p className="text-[10px] text-zinc-500">{linha.pesagem}</p>
                            <p className="text-[10px] text-zinc-600">{item.mp_payment_id ? `MP ${item.mp_payment_id}` : "Sem ID MP"}</p>
                        </td>
                          <td className="p-3">
                            <div className="flex flex-col gap-1">
                              {userId && <Link href={`/super-admin/suporte?org=${userId}`} className="text-[10px] font-bold uppercase tracking-widest text-yellow-300">Abrir painel</Link>}
                              {zap && <a href={zap} target="_blank" rel="noreferrer" className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">WhatsApp</a>}
                              {evento && <Link href={`/evento/${evento.id}`} className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Página pública</Link>}
                            </div>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {filtradas.length > limite && (
                <button type="button" onClick={() => setLimite((atual) => atual + 80)} className="mt-4 w-full rounded-xl border border-white/10 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-300">
                  Mostrar mais {Math.min(80, filtradas.length - limite)} de {filtradas.length - limite}
                </button>
              )}
            </div>
          </section>
        ) : (
          <section>
            {erroRetratt && <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{erroRetratt}</p>}
            <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <article className="rounded-2xl border border-cyan-500/30 bg-[#0a0a0e] p-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-cyan-300">Vendas Retratt</p>
                <p className="mt-2 text-xl font-black md:text-2xl">{centavos(retratt?.geral.faturamentoCentavos)}</p>
                <p className="mt-1 text-[10px] text-zinc-500">{retratt?.geral.pedidosPagos || 0} pedidos pagos</p>
              </article>
              <article className="rounded-2xl border border-white/10 bg-[#0a0a0e] p-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Comissão Itatame</p>
                <p className="mt-2 text-xl font-black md:text-2xl">{centavos(retratt?.geral.comissaoItatameCentavos)}</p>
                <p className="mt-1 text-[10px] text-zinc-500">Snapshot de cada venda de foto</p>
              </article>
              <article className="rounded-2xl border border-white/10 bg-[#0a0a0e] p-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Royalty em aberto</p>
                <p className="mt-2 text-xl font-black md:text-2xl">{centavos(retratt?.geral.royaltyEmAbertoCentavos)}</p>
                <p className="mt-1 text-[10px] text-zinc-500">Disponível {centavos(retratt?.geral.royaltyDisponivelCentavos)} · pago {centavos(retratt?.geral.royaltyPagoCentavos)}</p>
              </article>
              <article className="rounded-2xl border border-white/10 bg-[#0a0a0e] p-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Operação</p>
                <p className="mt-2 text-xl font-black md:text-2xl">{retratt?.geral.fotosVendidas || 0}</p>
                <p className="mt-1 text-[10px] text-zinc-500">{retratt?.geral.galerias || 0} galerias · {retratt?.geral.fotografos || 0} fotógrafos</p>
              </article>
            </div>

            <div className="mb-6 flex flex-wrap gap-3">
              <Link href="/super-admin/fotos" className="rounded-xl bg-cyan-500 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-black">Abrir financeiro completo e reembolsos</Link>
              <button type="button" onClick={exportarRetratt} className="rounded-xl border border-cyan-500/30 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-cyan-300">PDF dos royalties</button>
            </div>

            <div className="rounded-3xl border border-white/10 bg-[#0a0a0e] p-5">
              <div className="mb-4 flex flex-col justify-between gap-3 md:flex-row md:items-center">
                <div>
                  <h2 className="text-lg font-black">Organizadores na Retratt</h2>
                  <p className="mt-1 text-xs text-zinc-500">Royalties de foto. Não inclui inscrição de campeonato.</p>
                </div>
                <label className="relative w-full md:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={15} />
                  <input value={buscaRetratt} onChange={(event) => setBuscaRetratt(event.target.value)} placeholder="Buscar organizador da Retratt" className="w-full rounded-xl border border-white/10 bg-black py-2.5 pl-9 pr-3 text-xs outline-none focus:border-cyan-500" />
                </label>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-xs">
                  <thead className="text-[9px] uppercase tracking-widest text-zinc-500">
                    <tr>
                      <th className="p-3">Organizador</th>
                      <th className="p-3">Galerias</th>
                      <th className="p-3">Vendas</th>
                      <th className="p-3">Comissão</th>
                      <th className="p-3">Royalty aberto</th>
                      <th className="p-3">Já repassado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {retrattFiltrado.length === 0 ? (
                      <tr><td colSpan={6} className="p-8 text-center text-zinc-500">{carregandoRetratt ? "Carregando Retratt..." : "Nenhum organizador encontrado."}</td></tr>
                    ) : retrattFiltrado.map((item) => (
                      <tr key={item.id} className="border-t border-white/5">
                        <td className="p-3 font-bold">{item.nome}</td>
                        <td className="p-3">{item.galerias}</td>
                        <td className="p-3">{centavos(item.faturamentoCentavos)}</td>
                        <td className="p-3">{centavos(item.comissaoItatameCentavos)}</td>
                        <td className="p-3 text-amber-300">{centavos(item.royaltyEmAbertoCentavos)}</td>
                        <td className="p-3 text-emerald-300">{centavos(item.royaltyPagoCentavos)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

              <h3 className="mb-3 mt-8 text-sm font-black uppercase tracking-widest text-zinc-400">Pedidos pagos recentes</h3>
              <div className="space-y-2">
                {(retratt?.pedidosRecentes || []).map((pedido) => (
                  <article key={pedido.id} className="grid gap-2 rounded-xl border border-white/5 bg-black/40 p-3 text-xs md:grid-cols-5">
                    <div>
                      <p className="font-bold">{pedido.galeria}</p>
                      <p className="text-[10px] text-zinc-500">{dataCurta(pedido.data)} · {pedido.fotos} fotos</p>
                    </div>
                    <p className="text-zinc-300">{pedido.organizador}</p>
                    <p className="text-zinc-400">{pedido.fotografo}</p>
                    <p>{centavos(pedido.totalCentavos)} <span className="text-zinc-500">· comissão {centavos(pedido.comissaoItatameCentavos)}</span></p>
                    <p className="text-cyan-300">{rotuloRepasse[pedido.repasseStatus] || pedido.repasseStatus} · royalty {centavos(pedido.royaltyCentavos)}</p>
                  </article>
                ))}
          </div>
        </div>
          </section>
        )}
      </div>

      {showRegrasModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 p-4">
          <div className="w-full max-w-2xl rounded-3xl border border-blue-500/20 bg-[#0e0e12]">
            <div className="flex items-start justify-between border-b border-white/5 p-6">
              <div>
                <h2 className="text-xl font-black">Livro de regras</h2>
                <p className="mt-1 text-xs text-zinc-400">Categorias oficiais dos campeonatos Itatame.</p>
              </div>
              <button type="button" onClick={() => setShowRegrasModal(false)} className="rounded-lg bg-white/5 px-3 py-2 text-xs">Fechar</button>
            </div>
            <div className="space-y-4 p-6">
              <div className="flex gap-2">
                {(["peso", "idade", "faixa"] as const).map((tipo) => (
                  <button key={tipo} type="button" onClick={() => setNovaRegra({ ...novaRegra, tipo })} className={`flex-1 rounded-lg border py-2 text-[10px] font-black uppercase tracking-widest ${novaRegra.tipo === tipo ? "border-blue-500/40 bg-blue-500/10 text-blue-300" : "border-white/10 text-zinc-500"}`}>{tipo}</button>
                ))}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <select value={novaRegra.genero} onChange={(event) => setNovaRegra({ ...novaRegra, genero: event.target.value })} className="rounded-xl border border-white/10 bg-black px-3 py-3 text-xs">
                  <option>Masculino</option>
                  <option>Feminino</option>
                  <option>Ambos</option>
                    </select>
                <input value={novaRegra.nome} onChange={(event) => setNovaRegra({ ...novaRegra, nome: event.target.value })} placeholder="Nome da regra" className="rounded-xl border border-white/10 bg-black px-3 py-3 text-xs outline-none" />
              </div>
              <button
                type="button"
                disabled={!novaRegra.nome}
                onClick={() => {
                  alert(`Regra de ${novaRegra.tipo} [${novaRegra.nome}] anotada. A tabela categorias_globais ainda precisa existir no banco para publicar aos organizadores.`);
                  setNovaRegra({ tipo: "peso", nome: "", genero: "Masculino" });
                  setShowRegrasModal(false);
                }}
                className="w-full rounded-xl bg-blue-600 py-3 text-xs font-black uppercase tracking-widest disabled:opacity-40"
              >
                Adicionar ao livro
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function SelectFiltro({ value, onChange, placeholder, children }: { value: string; onChange: (valor: string) => void; placeholder: string; children: ReactNode }) {
  return (
    <div className="relative">
      <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full appearance-none rounded-xl border border-white/10 bg-black px-3 py-2.5 text-xs font-bold outline-none focus:border-red-500">
        {placeholder && <option value="">{placeholder}</option>}
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500" size={14} />
    </div>
  );
}
