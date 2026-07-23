export type EventoComEtapas = {
  status?: string | null;
  data_evento?: string | null;
  data_inicio_inscricoes?: string | null;
  data_fim_inscricoes?: string | null;
  data_fim_pagamento?: string | null;
  data_inicio_checagem?: string | null;
  data_fim_checagem?: string | null;
  data_divulgacao_chaves?: string | null;
  lote1_data_fim?: string | null;
  lote2_data_fim?: string | null;
  lote3_data_fim?: string | null;
};

export type CodigoEtapaEvento =
  | "EM_BREVE"
  | "INSCRICOES_ABERTAS"
  | "AGUARDANDO_CHECAGEM"
  | "CHECAGEM_ABERTA"
  | "EM_CHAVEAMENTO"
  | "CHAVES_PUBLICADAS"
  | "LUTAS_AO_VIVO"
  | "ENCERRADO";

export type TomEtapaEvento = "cyan" | "emerald" | "amber" | "violet" | "blue" | "red" | "zinc";

export type EtapaEvento = {
  codigo: CodigoEtapaEvento;
  titulo: string;
  detalhe: string;
  proximoPasso: string;
  tom: TomEtapaEvento;
  indice: number;
  totalEtapas: number;
  progresso: number;
  inscricoesAbertas: boolean;
  checagemAberta: boolean;
};

export type EstadoMarco = "concluido" | "atual" | "futuro";

export type MarcoEvento = {
  id: "inscricoes" | "pagamento" | "checagem" | "chaveamento" | "chaves" | "lutas";
  titulo: string;
  periodo: string;
  observacao: string;
  estado: EstadoMarco;
};

const TOTAL_ETAPAS = 6;

export function dataOperacional(valor?: string | null, fimDoDia = false) {
  if (!valor) return null;

  const somenteData = /^\d{4}-\d{2}-\d{2}$/.test(valor);
  const normalizado = somenteData
    ? `${valor}T${fimDoDia ? "23:59:59.999" : "00:00:00"}`
    : valor;
  const data = new Date(normalizado);

  return Number.isNaN(data.getTime()) ? null : data;
}

function formatarCurto(data: Date | null) {
  if (!data) return "data a definir";
  return data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function formatarDataHoraEvento(valor?: string | null, fimDoDia = false) {
  const data = dataOperacional(valor, fimDoDia);
  if (!data) return "A definir";

  const possuiHorario = Boolean(valor && valor.includes("T"));
  return data.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(possuiHorario ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).replace(",", " às");
}

function fimDasInscricoes(evento: EventoComEtapas) {
  const fimExplicito = dataOperacional(evento.data_fim_inscricoes, true);
  if (fimExplicito) return fimExplicito;

  return [
    dataOperacional(evento.lote3_data_fim, true),
    dataOperacional(evento.lote2_data_fim, true),
    dataOperacional(evento.lote1_data_fim, true),
  ].find(Boolean) || null;
}

function criarEtapa(
  codigo: CodigoEtapaEvento,
  titulo: string,
  detalhe: string,
  proximoPasso: string,
  tom: TomEtapaEvento,
  indice: number,
  inscricoesAbertas = false,
  checagemAberta = false,
): EtapaEvento {
  return {
    codigo,
    titulo,
    detalhe,
    proximoPasso,
    tom,
    indice,
    totalEtapas: TOTAL_ETAPAS,
    progresso: Math.round((indice / TOTAL_ETAPAS) * 100),
    inscricoesAbertas,
    checagemAberta,
  };
}

export function obterEtapaEvento(evento: EventoComEtapas, agora = new Date()): EtapaEvento {
  const status = String(evento.status || "").toUpperCase();
  const inicioInscricoes = dataOperacional(evento.data_inicio_inscricoes);
  const fimInscricoes = fimDasInscricoes(evento);
  const fimPagamento = dataOperacional(evento.data_fim_pagamento, true);
  const inicioChecagem = dataOperacional(evento.data_inicio_checagem);
  const fimChecagem = dataOperacional(evento.data_fim_checagem, true);
  const divulgacaoChaves = dataOperacional(evento.data_divulgacao_chaves);
  const inicioEvento = dataOperacional(evento.data_evento);
  const fimEvento = dataOperacional(evento.data_evento, true);

  if (status === "ENCERRADO" || (fimEvento && agora > fimEvento)) {
    return criarEtapa(
      "ENCERRADO",
      "Evento encerrado",
      "Resultados e chaves permanecem disponíveis",
      "Consulte os resultados oficiais",
      "zinc",
      6,
    );
  }

  if (inicioEvento && fimEvento && agora >= inicioEvento && agora <= fimEvento) {
    return criarEtapa(
      "LUTAS_AO_VIVO",
      "Lutas ao vivo",
      "Acompanhe chamadas, placares e resultados",
      "Abra o acompanhamento em tempo real",
      "red",
      5,
    );
  }

  if (divulgacaoChaves && agora >= divulgacaoChaves) {
    return criarEtapa(
      "CHAVES_PUBLICADAS",
      "Chaves publicadas",
      "Confira categoria, horário e caminho até o pódio",
      inicioEvento ? `Próxima etapa: lutas em ${formatarCurto(inicioEvento)}` : "Próxima etapa: início das lutas",
      "blue",
      4,
    );
  }

  if (inicioChecagem && agora >= inicioChecagem && (!fimChecagem || agora <= fimChecagem)) {
    return criarEtapa(
      "CHECAGEM_ABERTA",
      "Checagem aberta",
      fimChecagem ? `Correções até ${formatarCurto(fimChecagem)}` : "Revise seus dados e sua categoria",
      "Confirme peso, faixa, equipe e categoria",
      "amber",
      2,
      false,
      true,
    );
  }

  const checagemTerminou = Boolean(fimChecagem && agora > fimChecagem);
  if (checagemTerminou || (fimInscricoes && agora > fimInscricoes && (!inicioChecagem || agora >= inicioChecagem))) {
    return criarEtapa(
      "EM_CHAVEAMENTO",
      "Chaveamento em preparação",
      "Inscrições e correções foram concluídas",
      divulgacaoChaves ? `Chaves previstas para ${formatarCurto(divulgacaoChaves)}` : "Aguarde a publicação das chaves",
      "violet",
      3,
    );
  }

  if (
    (fimInscricoes && agora > fimInscricoes) ||
    (fimPagamento && agora > fimPagamento) ||
    (status === "OFICIAL" && !fimInscricoes)
  ) {
    return criarEtapa(
      "AGUARDANDO_CHECAGEM",
      "Inscrições encerradas",
      inicioChecagem ? `Checagem abre em ${formatarCurto(inicioChecagem)}` : "Aguarde a checagem dos atletas",
      "Próxima etapa: revisão das categorias",
      "amber",
      1,
    );
  }

  if ((inicioInscricoes && agora < inicioInscricoes) || (!inicioInscricoes && status === "EM BREVE")) {
    return criarEtapa(
      "EM_BREVE",
      "Inscrições em breve",
      inicioInscricoes ? `Abertura em ${formatarCurto(inicioInscricoes)}` : "Acompanhe a abertura das inscrições",
      "Prepare seus dados de atleta",
      "cyan",
      0,
    );
  }

  return criarEtapa(
    "INSCRICOES_ABERTAS",
    "Inscrições abertas",
    fimInscricoes ? `Garanta sua vaga até ${formatarCurto(fimInscricoes)}` : "Garanta sua vaga",
    fimPagamento ? `Pagamento até ${formatarCurto(fimPagamento)}` : "Finalize inscrição e pagamento",
    "emerald",
    1,
    true,
  );
}

function estadoPorIndice(indiceMarco: number, indiceAtual: number): EstadoMarco {
  if (indiceAtual > indiceMarco) return "concluido";
  if (indiceAtual === indiceMarco) return "atual";
  return "futuro";
}

export function obterLinhaDoTempoEvento(evento: EventoComEtapas, agora = new Date()): MarcoEvento[] {
  const etapa = obterEtapaEvento(evento, agora);
  const indiceAtual = etapa.codigo === "EM_BREVE" ? 0 : etapa.indice;
  const inicioInscricoes = formatarDataHoraEvento(evento.data_inicio_inscricoes);
  const fimInscricoesFormatado = formatarDataHoraEvento(evento.data_fim_inscricoes, true);
  const pagamento = formatarDataHoraEvento(evento.data_fim_pagamento, true);
  const inicioChecagem = formatarDataHoraEvento(evento.data_inicio_checagem);
  const fimChecagem = formatarDataHoraEvento(evento.data_fim_checagem, true);
  const divulgacaoChaves = formatarDataHoraEvento(evento.data_divulgacao_chaves);
  const dataEvento = formatarDataHoraEvento(evento.data_evento);

  return [
    {
      id: "inscricoes",
      titulo: "Inscrições",
      periodo: evento.data_inicio_inscricoes
        ? `${inicioInscricoes} — ${fimInscricoesFormatado}`
        : `Até ${fimInscricoesFormatado}`,
      observacao: "Cadastro do atleta e escolha das categorias.",
      estado: etapa.codigo === "EM_BREVE" ? "futuro" : estadoPorIndice(1, indiceAtual),
    },
    {
      id: "pagamento",
      titulo: "Pagamento",
      periodo: `Até ${pagamento}`,
      observacao: "A vaga só é confirmada após a compensação.",
      estado: estadoPorIndice(1, indiceAtual),
    },
    {
      id: "checagem",
      titulo: "Checagem dos atletas",
      periodo: evento.data_inicio_checagem ? `${inicioChecagem} — ${fimChecagem}` : "Período a definir",
      observacao: "Prazo para revisar peso, faixa, equipe e categoria.",
      estado: estadoPorIndice(2, indiceAtual),
    },
    {
      id: "chaveamento",
      titulo: "Montagem das chaves",
      periodo: evento.data_fim_checagem ? `Após ${fimChecagem}` : "Após o encerramento da checagem",
      observacao: "A organização valida categorias e confrontos.",
      estado: estadoPorIndice(3, indiceAtual),
    },
    {
      id: "chaves",
      titulo: "Chaves e cronograma",
      periodo: divulgacaoChaves,
      observacao: "Publicação dos confrontos e horários oficiais.",
      estado: estadoPorIndice(4, indiceAtual),
    },
    {
      id: "lutas",
      titulo: "Lutas e resultados",
      periodo: dataEvento,
      observacao: "Chamadas, placares e resultados em tempo real.",
      estado: estadoPorIndice(5, indiceAtual),
    },
  ];
}
