type EventoBuscaNumero = {
  nome?: string | null;
  descricao?: string | null;
  local?: string | null;
};

const TERMOS_COM_NUMERACAO_VISIVEL = [
  "corrida",
  "maratona",
  "meia maratona",
  "atletismo",
  "pedestre",
  "running",
  "trail run",
  "automobilismo",
  "motorsport",
  "motor sport",
  "stock car",
  "formula",
  "kart",
  "karting",
  "rally",
  "arrancada",
  "futebol",
  "futsal",
  "soccer",
  "football",
];

function normalizarTexto(valor: unknown) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function eventoPermiteBuscaPorNumero(evento: EventoBuscaNumero | null | undefined) {
  if (!evento) return false;
  const texto = normalizarTexto([evento.nome, evento.descricao, evento.local].filter(Boolean).join(" "));
  return TERMOS_COM_NUMERACAO_VISIVEL.some((termo) => texto.includes(termo));
}

export const BUSCA_NUMERO_MODALIDADES =
  "corridas de rua, automobilismo, kart e futebol";
