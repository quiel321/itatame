"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Copy, FileText, MapPin, MessageCircle, Search, ShieldCheck } from "lucide-react";
import { supabase } from "@/app/lib/supabase";
import { formatarTelefone } from "@/app/lib/formatar-telefone";
import { getPlanoComercial } from "@/app/lib/planos-comerciais";
import { baixarCsv, exportarPdfSuporte } from "@/app/lib/super-admin-relatorio";
import {
  buscarPaginas,
  dataCurta,
  eventosDoOrganizador,
  contagemPorOrganizador,
  indiceOrganizadores,
  inscricoesDoOrganizador,
  itemResumoDaInscricao,
  moeda,
  montarLinhaSuporte,
  resumirItatame,
  taxaComissao,
  situacaoInscricao,
  whatsappDe,
  type EventoPainel,
  type InscricaoPainel,
  type OrganizadorPainel,
} from "@/app/lib/super-admin-painel";

type RetrattOrganizador = {
  id: string;
  nome: string;
  galerias: number;
  faturamentoCentavos: number;
  comissaoItatameCentavos: number;
  royaltyEmAbertoCentavos: number;
  royaltyPagoCentavos: number;
};

function centavos(valor?: number | null) {
  return moeda((valor || 0) / 100);
}

export default function SuporteOrganizadorPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [organizadores, setOrganizadores] = useState<OrganizadorPainel[]>([]);
  const [eventos, setEventos] = useState<EventoPainel[]>([]);
  const [inscricoes, setInscricoes] = useState<InscricaoPainel[]>([]);
  const [retratt, setRetratt] = useState<RetrattOrganizador[]>([]);
  const [busca, setBusca] = useState("");
  const [selecionado, setSelecionado] = useState(params.get("org") || "");
  const [eventoFoco, setEventoFoco] = useState("todos");
  const [copiado, setCopiado] = useState("");

  useEffect(() => {
    let ativo = true;
    async function carregar() {
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
        if (ativo) setErro(falha instanceof Error ? falha.message : "Não foi possível abrir o painel de suporte.");
      } finally {
        if (ativo) setCarregando(false);
      }

      const { data: sessao } = await supabase.auth.getSession();
      const token = sessao.session?.access_token;
      if (!token || !ativo) return;
      const response = await fetch("/api/super-admin/fotos-financeiro", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!response.ok || !ativo) return;
      const resultado = await response.json();
      if (ativo) setRetratt(resultado.organizadores || []);
    }
    void carregar();
    return () => {
      ativo = false;
    };
  }, []);

  const mapa = useMemo(() => indiceOrganizadores(organizadores), [organizadores]);
  const organizador = selecionado ? mapa.get(selecionado) || organizadores.find((item) => item.user_id === selecionado || item.id === selecionado) : undefined;
  const userId = organizador?.user_id || "";
  const eventosDeste = userId ? eventosDoOrganizador(userId, eventos) : [];
  const inscricoesDeste = userId ? inscricoesDoOrganizador(userId, eventos, inscricoes) : [];
  const inscricoesFoco = eventoFoco === "todos" ? inscricoesDeste : inscricoesDeste.filter((item) => String(item.evento_id) === eventoFoco);
  const resumo = resumirItatame(inscricoesFoco.map((item) => itemResumoDaInscricao(item, mapa)));
  const retrattDeste = retratt.find((item) => item.id === userId);
  const plano = getPlanoComercial(organizador?.plano_comercial);
  const zap = whatsappDe(organizador?.telefone);

  const fichas = contagemPorOrganizador(eventos, inscricoes, mapa);
  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return organizadores
      .filter((item) => !termo || [item.nome, item.academia, item.email, item.telefone, item.cidade].join(" ").toLowerCase().includes(termo))
      .sort((a, b) => prioridade(a) - prioridade(b) || String(a.nome).localeCompare(String(b.nome), "pt-BR"));
  }, [busca, organizadores]);

  function abrir(alvo: OrganizadorPainel) {
    const id = alvo.user_id || alvo.id;
    setSelecionado(id);
    setEventoFoco("todos");
    router.replace(`/super-admin/suporte?org=${id}`);
  }

  async function copiar(texto: string, chave: string) {
    await navigator.clipboard.writeText(texto);
    setCopiado(chave);
    window.setTimeout(() => setCopiado(""), 1600);
  }

  function exportar(formato: "pdf" | "csv") {
    if (!organizador || inscricoesFoco.length === 0) {
      alert("Este organizador não tem inscrições no recorte atual.");
      return;
    }
    const eventosPorId = new Map(eventosDeste.map((evento) => [String(evento.id), evento]));
    const linhas = inscricoesFoco.map((item) => montarLinhaSuporte(item, organizador, item.evento_id != null ? eventosPorId.get(String(item.evento_id)) : undefined));
    if (formato === "csv") {
      baixarCsv(
        `suporte-${(organizador.nome || "organizador").toLowerCase().replace(/\s+/g, "-")}.csv`,
        ["Organizador", "Academia", "Contato", "Plano", "Mercado Pago", "Evento", "Data", "Atleta", "Equipe", "Categoria", "Faixa", "Peso", "Pacote", "Valor", "Pagamento", "Pesagem", "ID Mercado Pago"],
        linhas.map((linha) => [linha.organizador, linha.academia, linha.contato, linha.plano, linha.mercadoPago, linha.evento, linha.dataEvento, linha.atleta, linha.equipe, linha.categoria, linha.faixa, linha.peso, linha.pacote, linha.valor, linha.pagamento, linha.pesagem, linha.mercadoPagoId]),
      );
      return;
    }
    exportarPdfSuporte({
      titulo: `Suporte Itatame — ${organizador.nome || "Organizador"}`,
      subtitulo: `${organizador.academia || "Academia não informada"} · ${organizador.email || "sem e-mail"} · ${organizador.telefone ? formatarTelefone(organizador.telefone) : "sem telefone"} · gerado em ${new Date().toLocaleString("pt-BR")}`,
      resumo: [
        ["Status da conta", organizador.status || "—"],
        ["Plano", `${plano.nome} · ${taxaComissao(organizador)}%`],
        ["Mercado Pago", organizador.mp_connected_at ? "Conectado" : "Pendente"],
        ["Campeonatos", String(eventosDeste.length)],
        ["Faturamento pago", moeda(resumo.faturamento)],
        ["Comissão", moeda(resumo.comissao)],
        ["Repasse", moeda(resumo.repasse)],
        ["Pendente", moeda(resumo.pendente)],
        ["Retratt", retrattDeste ? centavos(retrattDeste.faturamentoCentavos) : "Sem operação"],
      ],
      linhas,
      nomeArquivo: `suporte-${(organizador.nome || "organizador").toLowerCase().replace(/\s+/g, "-")}.pdf`,
    });
  }

  if (carregando) {
    return <div className="flex min-h-screen items-center justify-center bg-[#050505] text-xs font-black uppercase tracking-widest text-yellow-400">Abrindo a visão dos organizadores...</div>;
  }

  return (
    <main className="min-h-screen bg-[#050505] p-4 text-white md:p-8">
      <div className="mx-auto max-w-7xl">
        <Link href="/super-admin" className="mb-4 inline-flex items-center gap-2 text-xs text-zinc-500 hover:text-white"><ArrowLeft size={14} /> Voltar ao QG</Link>
        <div className="mb-6 flex flex-col justify-between gap-4 border-b border-white/10 pb-6 md:flex-row md:items-end">
          <div>
            <p className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-yellow-400"><ShieldCheck size={13} /> Modo suporte · somente leitura</p>
            <h1 className="mt-2 text-3xl font-black md:text-4xl">Painel do organizador</h1>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400">A mesma visão que o suporte precisa da tela do organizador: conta, campeonatos, inscrições e o financeiro do Itatame separado da Retratt.</p>
          </div>
          {organizador && (
            <button type="button" onClick={() => { setSelecionado(""); router.replace("/super-admin/suporte"); }} className="rounded-xl border border-white/10 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-300">
              Trocar organizador
            </button>
          )}
        </div>

        {erro && <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{erro}</p>}

        {!organizador ? (
          <section>
            <label className="relative mb-5 block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
              <input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar por nome, academia, e-mail, telefone ou cidade" className="w-full rounded-xl border border-white/10 bg-black py-3 pl-10 pr-3 text-sm outline-none focus:border-yellow-500" />
            </label>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {lista.map((item) => {
                const ficha = item.user_id ? fichas.get(item.user_id) : undefined;
                const resumoCard = ficha?.resumo;
                const quantidadeEventos = ficha?.eventos || 0;
                return (
                  <button key={item.id} type="button" onClick={() => abrir(item)} className="rounded-2xl border border-white/10 bg-[#0a0a0e] p-4 text-left transition hover:border-yellow-500/40">
                    <div className="flex items-center gap-3">
                      {item.foto_url ? <img src={item.foto_url} alt="" className="h-12 w-12 rounded-full object-cover" /> : <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-900 text-xs font-black">{(item.nome || "?").slice(0, 1)}</div>}
                      <div className="min-w-0">
                        <p className="truncate font-black">{item.nome || "Sem nome"}</p>
                        <p className="truncate text-[11px] text-zinc-500">{item.academia || "Academia não informada"}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-1.5 text-[9px] font-bold uppercase tracking-widest">
                      <span className="rounded-md bg-white/5 px-2 py-1">{item.status || "sem status"}</span>
                      <span className="rounded-md bg-white/5 px-2 py-1">{getPlanoComercial(item.plano_comercial).nome}</span>
                      <span className={`rounded-md px-2 py-1 ${item.mp_connected_at ? "bg-emerald-500/10 text-emerald-300" : "bg-yellow-500/10 text-yellow-200"}`}>{item.mp_connected_at ? "MP ok" : "MP pendente"}</span>
                    </div>
                    <p className="mt-3 text-xs text-zinc-400">{quantidadeEventos} campeonatos · {resumoCard?.pagos || 0} pagos · {resumoCard?.pendentes || 0} pendentes · {moeda(resumoCard?.faturamento || 0)}</p>
                  </button>
                );
              })}
            </div>
            {lista.length === 0 && <p className="py-16 text-center text-sm text-zinc-500">Nenhum organizador encontrado.</p>}
          </section>
        ) : (
          <section>
            <div className="mb-4 flex flex-wrap gap-2 text-[11px]">
              {organizador.status !== "aprovado" && <span className="rounded-full border border-yellow-500/40 bg-yellow-500/10 px-3 py-1 text-yellow-200">Conta {organizador.status}. O organizador pode não conseguir operar.</span>}
              {!organizador.mp_connected_at && <span className="rounded-full border border-yellow-500/40 bg-yellow-500/10 px-3 py-1 text-yellow-200">Mercado Pago ainda não conectado. Pagamentos online não caem na conta dele.</span>}
              {resumo.pendentes > 0 && <span className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-red-200">{resumo.pendentes} inscrições aguardando pagamento ({moeda(resumo.pendente)}).</span>}
              {eventosDeste.length === 0 && <span className="rounded-full border border-white/10 px-3 py-1 text-zinc-300">Nenhum campeonato criado nesta conta.</span>}
            </div>

            <div className="mb-5 rounded-3xl border border-red-500/30 bg-gradient-to-r from-red-950/40 to-black p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                  {organizador.foto_url ? <img src={organizador.foto_url} alt="" className="h-16 w-16 rounded-full border-2 border-red-500/40 object-cover" /> : <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-900 font-black">{(organizador.nome || "?").slice(0, 1)}</div>}
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-red-300">Área do organizador</p>
                    <h2 className="text-2xl font-black">{organizador.nome}</h2>
                    <p className="text-sm text-zinc-400">{organizador.academia || "Academia não informada"} · {plano.nome} · comissão {taxaComissao(organizador)}%</p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-zinc-500"><MapPin size={12} /> {[organizador.cidade, organizador.estado].filter(Boolean).join(" / ") || "Cidade não informada"}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {zap && <a href={zap} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-black"><MessageCircle size={13} /> WhatsApp</a>}
                  {organizador.email && <button type="button" onClick={() => copiar(organizador.email || "", "email")} className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest"><Copy size={13} /> {copiado === "email" ? "E-mail copiado" : organizador.email}</button>}
                  {organizador.telefone && <button type="button" onClick={() => copiar(organizador.telefone || "", "tel")} className="rounded-lg border border-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest">{copiado === "tel" ? "Telefone copiado" : formatarTelefone(organizador.telefone)}</button>}
                </div>
              </div>
            </div>

            <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Card titulo="Faturamento Itatame" valor={moeda(resumo.faturamento)} detalhe={`${resumo.pagos} pagas neste recorte`} />
              <Card titulo="Comissão / repasse" valor={moeda(resumo.comissao)} detalhe={`Organizador fica com ${moeda(resumo.repasse)}`} />
              <Card titulo="Aguardando" valor={moeda(resumo.pendente)} detalhe={`${resumo.pendentes} pendentes · ${moeda(resumo.estornado)} estornado`} />
              <Card titulo="Mercado Pago" valor={organizador.mp_connected_at ? "Conectado" : "Pendente"} detalhe={organizador.mp_connected_at ? `Desde ${dataCurta(organizador.mp_connected_at)}` : "Peça para conectar no painel dele"} />
            </div>

            <article className="mb-5 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-cyan-300">Retratt · separado do campeonato</p>
              {retrattDeste ? (
                <p className="mt-2 text-sm text-zinc-300">{retrattDeste.galerias} galerias · vendas {centavos(retrattDeste.faturamentoCentavos)} · comissão {centavos(retrattDeste.comissaoItatameCentavos)} · royalty aberto {centavos(retrattDeste.royaltyEmAbertoCentavos)} · já repassado {centavos(retrattDeste.royaltyPagoCentavos)}</p>
              ) : (
                <p className="mt-2 text-sm text-zinc-400">Esta conta não tem operação de fotos na Retratt.</p>
              )}
              <Link href="/super-admin/fotos" className="mt-2 inline-block text-[10px] font-bold uppercase tracking-widest text-cyan-300">Abrir financeiro da Retratt</Link>
            </article>

            <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
              <button type="button" onClick={() => setEventoFoco("todos")} className={`shrink-0 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest ${eventoFoco === "todos" ? "bg-white text-black" : "bg-white/5 text-zinc-400"}`}>Todos os campeonatos</button>
              {eventosDeste.map((evento) => (
                <button key={evento.id} type="button" onClick={() => setEventoFoco(String(evento.id))} className={`shrink-0 rounded-xl px-3 py-2 text-left text-[10px] font-bold ${eventoFoco === String(evento.id) ? "bg-red-600 text-white" : "bg-white/5 text-zinc-300"}`}>
                  {evento.nome}
                  <span className="mt-0.5 block font-medium normal-case tracking-normal text-[10px] opacity-80">{dataCurta(evento.data_evento)} · inscrições até {dataCurta(evento.data_fim_inscricoes)}</span>
                </button>
              ))}
            </div>

            {eventoFoco !== "todos" && (
              <div className="mb-4 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-widest">
                <Link href={`/evento/${eventoFoco}`} className="rounded-lg bg-red-600 px-3 py-2">Página pública</Link>
                <span className="rounded-lg border border-white/10 px-3 py-2 text-zinc-400">{eventosDeste.find((evento) => String(evento.id) === eventoFoco)?.local || "Local não informado"} · {[eventosDeste.find((evento) => String(evento.id) === eventoFoco)?.cidade, eventosDeste.find((evento) => String(evento.id) === eventoFoco)?.estado].filter(Boolean).join(" / ")}</span>
              </div>
            )}

            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-black uppercase tracking-widest">Inscrições que o organizador vê</h3>
              <div className="flex gap-2">
                <button type="button" onClick={() => exportar("csv")} className="rounded-lg border border-white/10 px-3 py-2 text-[10px] font-bold uppercase tracking-widest">CSV</button>
                <button type="button" onClick={() => exportar("pdf")} className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-red-300"><FileText size={13} /> PDF desta conta</button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full min-w-[860px] text-left text-xs">
                <thead className="bg-black text-[9px] uppercase tracking-widest text-zinc-500">
                  <tr>
                    <th className="p-3">Atleta</th>
                    <th className="p-3">Campeonato</th>
                    <th className="p-3">Categoria</th>
                    <th className="p-3">Valor</th>
                    <th className="p-3">Pagamento</th>
                    <th className="p-3">Pesagem</th>
                  </tr>
                </thead>
                <tbody>
                  {inscricoesFoco.length === 0 ? (
                    <tr><td colSpan={6} className="p-8 text-center text-zinc-500">Nenhuma inscrição neste recorte.</td></tr>
                  ) : inscricoesFoco.map((item) => {
                    const linha = montarLinhaSuporte(item, organizador, eventosDeste.find((evento) => String(evento.id) === String(item.evento_id)));
                    const atual = situacaoInscricao(item);
                    return (
                      <tr key={item.id} className="border-t border-white/5">
                        <td className="p-3"><p className="font-bold">{linha.atleta}</p><p className="text-[10px] text-zinc-500">{linha.equipe}</p></td>
                        <td className="p-3"><p>{linha.evento}</p><p className="text-[10px] text-zinc-500">{linha.dataEvento}</p></td>
                        <td className="p-3"><p>{linha.categoria}</p><p className="text-[10px] text-zinc-500">{linha.faixa} · {linha.peso} · {linha.pacote}{item.idade ? ` · ${item.idade} anos` : ""}</p></td>
                        <td className="p-3 font-bold">{linha.valor}</td>
                        <td className={`p-3 ${atual === "pago" ? "text-emerald-400" : atual === "estornado" ? "text-red-400" : "text-yellow-300"}`}>{linha.pagamento}<span className="mt-1 block text-[10px] text-zinc-500">{item.mp_payment_id || "Sem ID MP"}</span></td>
                        <td className="p-3 text-zinc-400">{linha.pesagem}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function prioridade(organizador: OrganizadorPainel) {
  if (organizador.status === "pendente") return 0;
  if (organizador.status === "aprovado" && !organizador.mp_connected_at) return 1;
  if (organizador.status === "bloqueado") return 3;
  return 2;
}

function Card({ titulo, valor, detalhe }: { titulo: string; valor: string; detalhe: string }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-[#0a0a0e] p-4">
      <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">{titulo}</p>
      <p className="mt-2 text-xl font-black">{valor}</p>
      <p className="mt-1 text-[10px] text-zinc-500">{detalhe}</p>
    </article>
  );
}
