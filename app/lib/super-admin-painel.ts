import { formatarTelefone } from "@/app/lib/formatar-telefone";
import { getPlanoComercial } from "@/app/lib/planos-comerciais";
import { pacoteInscricao, rotuloPacoteInscricao } from "@/app/lib/valor-inscricao";

export type LinhaSuporteItatame = {
  organizador: string;
  academia: string;
  contato: string;
  plano: string;
  mercadoPago: string;
  evento: string;
  dataEvento: string;
  atleta: string;
  equipe: string;
  categoria: string;
  faixa: string;
  peso: string;
  pacote: string;
  valor: string;
  pagamento: string;
  pesagem: string;
  mercadoPagoId: string;
};

export type OrganizadorPainel = {
  id: string;
  user_id: string | null;
  nome: string | null;
  academia: string | null;
  email: string | null;
  telefone: string | null;
  foto_url: string | null;
  status: string | null;
  plano_comercial: string | null;
  comissao_percentual: number | string | null;
  mp_connected_at: string | null;
  cidade: string | null;
  estado: string | null;
  documento: string | null;
  created_at: string | null;
};

export type EventoPainel = {
  id: string | number;
  nome: string | null;
  data_evento: string | null;
  data_fim_inscricoes: string | null;
  organizador_id: string | null;
  cidade: string | null;
  estado: string | null;
  local: string | null;
};

export type EventoEmbutido = {
  nome?: string | null;
  organizador_id?: string | null;
  data_evento?: string | null;
  cidade?: string | null;
};

export type InscricaoPainel = {
  id: string | number;
  atleta?: string | null;
  equipe?: string | null;
  categoria?: string | null;
  faixa?: string | null;
  peso?: string | number | null;
  idade?: string | number | null;
  absoluto?: boolean | null;
  pagamento_ok?: boolean | null;
  pesagem_ok?: boolean | null;
  valor_inscricao?: number | string | null;
  valor_total?: number | string | null;
  mp_payment_id?: string | null;
  estorno_status?: string | null;
  estorno_valor?: number | string | null;
  created_at?: string | null;
  evento_id?: string | number | null;
  eventos?: EventoEmbutido | EventoEmbutido[] | null;
};

export type SituacaoInscricao = "pago" | "pendente" | "estornado";

export type ResumoItatame = {
  inscricoes: number;
  pagos: number;
  pendentes: number;
  estornos: number;
  faturamento: number;
  comissao: number;
  repasse: number;
  pendente: number;
  estornado: number;
};

export type ItemResumoItatame = {
  valor: number;
  situacao: SituacaoInscricao;
  taxaPercentual: number;
};

const resumoVazio = (): ResumoItatame => ({
  inscricoes: 0,
  pagos: 0,
  pendentes: 0,
  estornos: 0,
  faturamento: 0,
  comissao: 0,
  repasse: 0,
  pendente: 0,
  estornado: 0,
});

function dinheiro(valor: number) {
  return Number(valor.toFixed(2));
}

export function valorInscricao(item: { valor_total?: unknown; valor_inscricao?: unknown; estorno_valor?: unknown; estorno_status?: string | null; pagamento_ok?: boolean | null }) {
  if (item.estorno_status === "estornado") {
    const estorno = Number(item.estorno_valor);
    if (Number.isFinite(estorno) && estorno > 0) return estorno;
  }
  const total = Number(item.valor_total);
  if (Number.isFinite(total) && total > 0) return total;
  const base = Number(item.valor_inscricao);
  return Number.isFinite(base) && base > 0 ? base : 0;
}

export function situacaoInscricao(item: { pagamento_ok?: boolean | null; estorno_status?: string | null }): SituacaoInscricao {
  if (item.estorno_status === "estornado") return "estornado";
  if (item.pagamento_ok) return "pago";
  return "pendente";
}

export function taxaComissao(organizador?: { plano_comercial?: string | null; comissao_percentual?: number | string | null } | null) {
  const percentual = Number(organizador?.comissao_percentual);
  if (organizador?.comissao_percentual !== null && organizador?.comissao_percentual !== undefined && organizador.comissao_percentual !== "" && Number.isFinite(percentual) && percentual >= 0) {
    return percentual;
  }
  return getPlanoComercial(organizador?.plano_comercial).comissaoPercentual;
}

export function resumirItatame(itens: ItemResumoItatame[]): ResumoItatame {
  const resumo = resumoVazio();
  resumo.inscricoes = itens.length;
  for (const item of itens) {
    if (item.situacao === "estornado") {
      resumo.estornos += 1;
      resumo.estornado += item.valor;
      continue;
    }
    if (item.situacao === "pago") {
      const comissao = Number(((item.valor * item.taxaPercentual) / 100).toFixed(2));
      resumo.pagos += 1;
      resumo.faturamento += item.valor;
      resumo.comissao += comissao;
      resumo.repasse += item.valor - comissao;
      continue;
    }
    resumo.pendentes += 1;
    resumo.pendente += item.valor;
  }
  resumo.faturamento = dinheiro(resumo.faturamento);
  resumo.comissao = dinheiro(resumo.comissao);
  resumo.repasse = dinheiro(resumo.repasse);
  resumo.pendente = dinheiro(resumo.pendente);
  resumo.estornado = dinheiro(resumo.estornado);
  return resumo;
}

export function eventoEmbutido(item: InscricaoPainel) {
  return Array.isArray(item.eventos) ? item.eventos[0] : item.eventos;
}

export function indiceOrganizadores(lista: OrganizadorPainel[]) {
  const mapa = new Map<string, OrganizadorPainel>();
  for (const organizador of lista) {
    if (!organizador.user_id) continue;
    const atual = mapa.get(organizador.user_id);
    if (!atual || (atual.status !== "aprovado" && organizador.status === "aprovado")) {
      mapa.set(organizador.user_id, organizador);
    }
  }
  return mapa;
}

export function dataCurta(valor?: string | null) {
  if (!valor) return "Data a definir";
  const [ano, mes, dia] = valor.slice(0, 10).split("-");
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : valor;
}

export function moeda(valor: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor || 0);
}

export function textoPeso(peso?: string | number | null) {
  if (peso === null || peso === undefined || peso === "") return "—";
  return `${peso} kg`;
}

export function rotuloPacote(item: { absoluto?: boolean | null; categoria?: string | null }) {
  return rotuloPacoteInscricao(pacoteInscricao(item));
}

export function rotuloSituacao(situacao: SituacaoInscricao) {
  if (situacao === "pago") return "Pago";
  if (situacao === "estornado") return "Estornado";
  return "Pendente";
}

export function whatsappDe(telefone?: string | null) {
  const digitos = String(telefone || "").replace(/\D/g, "");
  if (digitos.length < 10) return null;
  const comPais = digitos.startsWith("55") ? digitos : `55${digitos}`;
  return `https://wa.me/${comPais}`;
}

export function itemResumoDaInscricao(item: InscricaoPainel, organizadores: Map<string, OrganizadorPainel>): ItemResumoItatame {
  const evento = eventoEmbutido(item);
  const organizador = evento?.organizador_id ? organizadores.get(evento.organizador_id) : undefined;
  return {
    valor: valorInscricao(item),
    situacao: situacaoInscricao(item),
    taxaPercentual: taxaComissao(organizador),
  };
}

export function contagemPorOrganizador(eventos: EventoPainel[], inscricoes: InscricaoPainel[], organizadores: Map<string, OrganizadorPainel>) {
  const usuarioPorEvento = new Map<string, string>();
  const eventosCount = new Map<string, number>();
  for (const evento of eventos) {
    if (!evento.organizador_id) continue;
    usuarioPorEvento.set(String(evento.id), evento.organizador_id);
    eventosCount.set(evento.organizador_id, (eventosCount.get(evento.organizador_id) || 0) + 1);
  }

  const grupos = new Map<string, InscricaoPainel[]>();
  for (const item of inscricoes) {
    const userId = (item.evento_id != null ? usuarioPorEvento.get(String(item.evento_id)) : undefined) || eventoEmbutido(item)?.organizador_id;
    if (!userId) continue;
    const lista = grupos.get(userId) || [];
    lista.push(item);
    grupos.set(userId, lista);
  }

  const fichas = new Map<string, { eventos: number; resumo: ResumoItatame }>();
  for (const userId of new Set([...eventosCount.keys(), ...grupos.keys()])) {
    fichas.set(userId, {
      eventos: eventosCount.get(userId) || 0,
      resumo: resumirItatame((grupos.get(userId) || []).map((item) => itemResumoDaInscricao(item, organizadores))),
    });
  }
  return fichas;
}

export function inscricoesDoOrganizador(userId: string | null, eventos: EventoPainel[], inscricoes: InscricaoPainel[]) {
  const ids = new Set(eventos.filter((evento) => evento.organizador_id === userId).map((evento) => String(evento.id)));
  return inscricoes.filter((item) => {
    if (item.evento_id != null && ids.has(String(item.evento_id))) return true;
    return eventoEmbutido(item)?.organizador_id === userId;
  });
}

export function eventosDoOrganizador(userId: string | null, eventos: EventoPainel[]) {
  return eventos.filter((evento) => evento.organizador_id === userId);
}

export async function buscarPaginas<T>(
  buscar: (inicio: number, fim: number) => Promise<{ data: T[] | null; error: { message: string } | null }>,
) {
  const tamanho = 1000;
  const todos: T[] = [];
  for (let inicio = 0; inicio <= 20000; inicio += tamanho) {
    const { data, error } = await buscar(inicio, inicio + tamanho - 1);
    if (error) throw new Error(error.message);
    const lote = data || [];
    todos.push(...lote);
    if (lote.length < tamanho) break;
  }
  return todos;
}

export function montarLinhaSuporte(item: InscricaoPainel, organizador?: OrganizadorPainel, evento?: EventoPainel): LinhaSuporteItatame {
  const embutido = eventoEmbutido(item);
  const plano = getPlanoComercial(organizador?.plano_comercial);
  const telefone = organizador?.telefone ? formatarTelefone(organizador.telefone) : "";
  return {
    organizador: organizador?.nome || "Organizador não identificado",
    academia: organizador?.academia || "—",
    contato: [telefone, organizador?.email].filter(Boolean).join(" · ") || "—",
    plano: `${plano.nome} · ${taxaComissao(organizador)}%`,
    mercadoPago: organizador?.mp_connected_at ? "Mercado Pago conectado" : "Mercado Pago pendente",
    evento: evento?.nome || embutido?.nome || "Evento não identificado",
    dataEvento: dataCurta(evento?.data_evento || embutido?.data_evento),
    atleta: item.atleta || "—",
    equipe: item.equipe || "—",
    categoria: item.categoria || "—",
    faixa: item.faixa || "—",
    peso: textoPeso(item.peso),
    pacote: rotuloPacote(item),
    valor: moeda(valorInscricao(item)),
    pagamento: rotuloSituacao(situacaoInscricao(item)),
    pesagem: item.pesagem_ok ? "Pesagem ok" : "Pesagem pendente",
    mercadoPagoId: item.mp_payment_id || "—",
  };
}
