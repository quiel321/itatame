export const IDADE_MAX_INFANTIL_PADRAO = 15;

export type RegrasValoresInscricao = {
  valor_absoluto?: number | string | null;
  valor_absoluto_infantil?: number | string | null;
  valor_absoluto_avulso?: number | string | null;
  valor_absoluto_avulso_infantil?: number | string | null;
  lote1_valor_infantil?: number | string | null;
  lote2_valor_infantil?: number | string | null;
  lote3_valor_infantil?: number | string | null;
  idade_max_infantil?: number | string | null;
};

export type EventoValoresInscricao = {
  lote1_valor?: number | string | null;
  lote1_data_fim?: string | null;
  lote2_valor?: number | string | null;
  lote2_data_fim?: string | null;
  lote3_valor?: number | string | null;
  lote3_data_fim?: string | null;
  valor_absoluto?: number | string | null;
  regras_pontuacao_equipes?: RegrasValoresInscricao | string | null;
};

function numeroValor(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function valorOpcional(value: unknown) {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function dataFimLote(valor?: string | null) {
  if (!valor) return null;
  return new Date(valor.includes("T") ? valor : `${valor}T23:59:59`);
}

function primeiroNumeroDefinido(...valores: unknown[]) {
  for (const valor of valores) {
    const parsed = valorOpcional(valor);
    if (parsed !== undefined) return parsed;
  }
  return 0;
}

export function regrasValoresInscricao(evento: EventoValoresInscricao): RegrasValoresInscricao {
  const bruto = evento.regras_pontuacao_equipes;
  if (!bruto) return {};
  if (typeof bruto === "string") {
    try {
      const parsed = JSON.parse(bruto);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof bruto === "object" ? bruto : {};
}

export function idadeMaxInfantil(evento: EventoValoresInscricao) {
  const max = Number(regrasValoresInscricao(evento).idade_max_infantil);
  return Number.isInteger(max) && max >= 4 && max <= 17 ? max : IDADE_MAX_INFANTIL_PADRAO;
}

export function inscricaoInfantil(idade: unknown, evento: EventoValoresInscricao) {
  const idadeNum = Number(idade);
  return Number.isInteger(idadeNum) && idadeNum >= 4 && idadeNum <= idadeMaxInfantil(evento);
}

export function valorInfantilLote(evento: EventoValoresInscricao, lote: 1 | 2 | 3) {
  const regras = regrasValoresInscricao(evento);
  if (lote === 1) return valorOpcional(regras.lote1_valor_infantil);
  if (lote === 2) return valorOpcional(regras.lote2_valor_infantil);
  return valorOpcional(regras.lote3_valor_infantil);
}

function valorDoLote(adulto: unknown, infantil: unknown, usarInfantil: boolean) {
  if (usarInfantil) {
    const kid = valorOpcional(infantil);
    if (kid !== undefined) return kid;
  }
  return numeroValor(adulto);
}

export function valorAddonAbsoluto(evento: EventoValoresInscricao, idade?: unknown) {
  const regras = regrasValoresInscricao(evento);
  const adulto = primeiroNumeroDefinido(evento.valor_absoluto, regras.valor_absoluto);
  if (!inscricaoInfantil(idade, evento)) return adulto;
  const kid = valorOpcional(regras.valor_absoluto_infantil);
  return kid !== undefined ? kid : adulto;
}

export function inscricaoSomenteAbsoluto(inscricao: { absoluto?: boolean | null; categoria?: string | null }) {
  return inscricao.absoluto === true && String(inscricao.categoria || '').trim().toLowerCase() === 'absoluto';
}

export type PacoteInscricao = 'peso' | 'absoluto' | 'combo';

export function pacoteInscricao(inscricao: { absoluto?: boolean | null; categoria?: string | null }): PacoteInscricao {
  if (inscricaoSomenteAbsoluto(inscricao)) return 'absoluto';
  if (inscricao.absoluto) return 'combo';
  return 'peso';
}

export function rotuloPacoteInscricao(pacote: PacoteInscricao) {
  if (pacote === 'absoluto') return 'Só absoluto';
  if (pacote === 'combo') return 'Peso + Absoluto';
  return 'Só peso';
}

export function pacoteDoTipoInscricao(tipo: string): PacoteInscricao {
  if (tipo === 'absoluto') return 'absoluto';
  if (tipo === 'ambos') return 'combo';
  return 'peso';
}

export function podeAmpliarPacote(atual: PacoteInscricao, desejado: PacoteInscricao) {
  if (atual === 'combo' || atual === desejado) return false;
  return true;
}

export function pacoteAposAmpliar(atual: PacoteInscricao, desejado: PacoteInscricao): PacoteInscricao {
  if (atual === 'combo' || desejado === 'combo' || atual !== desejado) return 'combo';
  return atual;
}

export function aplicarDescontoCupom(base: number, cupom?: { desconto_porcentagem?: number | null; desconto_valor?: number | null } | null) {
  if (!cupom) return Number(base.toFixed(2));
  const desconto = Number(cupom.desconto_porcentagem || 0) > 0
    ? base * Math.min(100, Number(cupom.desconto_porcentagem)) / 100
    : Number(cupom.desconto_valor || 0);
  return Number(Math.max(0, base - desconto).toFixed(2));
}

export function valorAindaDevido(
  inscricao: {
    absoluto?: boolean | null;
    categoria?: string | null;
    idade?: string | number | null;
    pagamento_ok?: boolean | null;
    valor_inscricao?: number | string | null;
  },
  evento: EventoValoresInscricao,
  cupom?: { desconto_porcentagem?: number | null; desconto_valor?: number | null } | null,
  agora = new Date(),
) {
  const devido = aplicarDescontoCupom(calcularValorInscricao(inscricao, evento, agora), cupom);
  if (!inscricao.pagamento_ok) return devido;
  return Number(Math.max(0, devido - Number(inscricao.valor_inscricao || 0)).toFixed(2));
}

export function valorAbsolutoAvulso(evento: EventoValoresInscricao, idade?: unknown) {
  const regras = regrasValoresInscricao(evento);
  const extra = valorAddonAbsoluto(evento, idade);
  if (!inscricaoInfantil(idade, evento)) {
    const adulto = valorOpcional(regras.valor_absoluto_avulso);
    return adulto !== undefined ? adulto : extra;
  }
  const kid = valorOpcional(regras.valor_absoluto_avulso_infantil);
  if (kid !== undefined) return kid;
  const adulto = valorOpcional(regras.valor_absoluto_avulso);
  return adulto !== undefined ? adulto : extra;
}

export function formatarValorInscricao(valor: number) {
  return `R$ ${numeroValor(valor).toFixed(2).replace('.', ',')}`;
}

export function valorComboPesoAbsoluto(valorLote: number, evento: EventoValoresInscricao, idade?: unknown) {
  return numeroValor(valorLote) + valorAddonAbsoluto(evento, idade);
}

export function valorLoteVigente(evento: EventoValoresInscricao, agora = new Date(), idade?: unknown) {
  const regras = regrasValoresInscricao(evento);
  const usarInfantil = inscricaoInfantil(idade, evento);
  const lote1Fim = dataFimLote(evento.lote1_data_fim);
  const lote2Fim = dataFimLote(evento.lote2_data_fim);
  const lote3Fim = dataFimLote(evento.lote3_data_fim);

  if (lote1Fim && agora <= lote1Fim) return valorDoLote(evento.lote1_valor, regras.lote1_valor_infantil, usarInfantil);
  if (lote2Fim && agora <= lote2Fim) return valorDoLote(evento.lote2_valor, regras.lote2_valor_infantil, usarInfantil);
  if (lote3Fim && agora <= lote3Fim) return valorDoLote(evento.lote3_valor, regras.lote3_valor_infantil, usarInfantil);

  const adulto = numeroValor(evento.lote3_valor) || numeroValor(evento.lote2_valor) || numeroValor(evento.lote1_valor);
  if (!usarInfantil) return adulto;
  const kid = valorOpcional(regras.lote3_valor_infantil)
    ?? valorOpcional(regras.lote2_valor_infantil)
    ?? valorOpcional(regras.lote1_valor_infantil);
  return kid !== undefined ? kid : adulto;
}

export function tarifaInfantilAplicavel(evento: EventoValoresInscricao, idade?: unknown, agora = new Date()) {
  if (!inscricaoInfantil(idade, evento)) return false;
  const vigente = valorLoteVigente(evento, agora, idade);
  const adulto = valorLoteVigente(evento, agora);
  const addonKid = valorAddonAbsoluto(evento, idade);
  const addonAdulto = valorAddonAbsoluto(evento);
  const avulsoKid = valorAbsolutoAvulso(evento, idade);
  const avulsoAdulto = valorAbsolutoAvulso(evento);
  return vigente !== adulto || addonKid !== addonAdulto || avulsoKid !== avulsoAdulto;
}

export function calcularValorInscricao(
  inscricao: { absoluto?: boolean | null; categoria?: string | null; idade?: string | number | null },
  evento: EventoValoresInscricao,
  agora = new Date(),
) {
  if (inscricaoSomenteAbsoluto(inscricao)) return valorAbsolutoAvulso(evento, inscricao.idade);
  const valor = valorLoteVigente(evento, agora, inscricao.idade);
  const lutaPesoEAbsoluto = inscricao.absoluto === true && inscricao.categoria !== "Absoluto";
  return lutaPesoEAbsoluto ? valor + valorAddonAbsoluto(evento, inscricao.idade) : valor;
}
