// Os horários do campeonato pertencem ao local do evento, independentemente
// do fuso do navegador do organizador ou do atleta.
const FUSOS_POR_ESTADO: Record<string, string> = {
  AC: "America/Rio_Branco", AM: "America/Manaus", MS: "America/Campo_Grande",
  MT: "America/Cuiaba", RO: "America/Porto_Velho", RR: "America/Boa_Vista",
};

export function fusoHorarioEvento(estado?: string | null) {
  return FUSOS_POR_ESTADO[estado?.toUpperCase() || ""] || "America/Sao_Paulo";
}

function partesNoFuso(data: Date, fuso: string) {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: fuso, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(data);
  return Object.fromEntries(partes.map(({ type, value }) => [type, value]));
}

export function paraInputDateTimeEvento(valor?: string | null, estado?: string | null) {
  if (!valor) return "";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "";
  const p = partesNoFuso(data, fusoHorarioEvento(estado));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

export function dataHoraLocalParaIso(valor?: string | null, estado?: string | null) {
  if (!valor) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(valor);
  if (!match) throw new Error("Data e horário inválidos.");
  const [, ano, mes, dia, hora, minuto, segundo = "00"] = match;
  const horaLocalComoUtc = Date.UTC(+ano, +mes - 1, +dia, +hora, +minuto, +segundo);
  let instante = horaLocalComoUtc;
  const fuso = fusoHorarioEvento(estado);
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const p = partesNoFuso(new Date(instante), fuso);
    const horarioObtidoComoUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
    const diferenca = horaLocalComoUtc - horarioObtidoComoUtc;
    if (!diferenca) break;
    instante += diferenca;
  }
  if (paraInputDateTimeEvento(new Date(instante).toISOString(), estado) !== valor.slice(0, 16)) {
    throw new Error("Esse horário não existe no fuso do evento. Escolha outro horário.");
  }
  return new Date(instante).toISOString();
}

export function dataOperacionalEvento(valor?: string | null, fimDoDia = false, estado?: string | null) {
  if (!valor) return null;
  const somenteData = /^\d{4}-\d{2}-\d{2}$/.test(valor);
  const normalizado = somenteData
    ? dataHoraLocalParaIso(`${valor}T${fimDoDia ? "23:59:59" : "00:00:00"}`, estado)
    : valor;
  const data = new Date(normalizado || "");
  if (somenteData && fimDoDia && !Number.isNaN(data.getTime())) data.setMilliseconds(999);
  return Number.isNaN(data.getTime()) ? null : data;
}

export function formatarDataHoraNoFuso(valor?: string | null, fimDoDia = false, estado?: string | null) {
  const data = dataOperacionalEvento(valor, fimDoDia, estado);
  if (!data) return "A definir";
  const possuiHorario = Boolean(valor && valor.includes("T"));
  return data.toLocaleString("pt-BR", {
    timeZone: fusoHorarioEvento(estado), day: "2-digit", month: "2-digit", year: "numeric",
    ...(possuiHorario ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).replace(",", " às");
}
