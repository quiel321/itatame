export const IDADE_MINIMA_CONTA = 18;

export const MENSAGEM_MENOR_DE_IDADE =
  "Menor de 18 anos não cria conta própria. Peça ao pai ou responsável para criar a conta com os dados dele e cadastrar você como dependente.";

function hojeCivil(agora: Date) {
  const texto = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Cuiaba",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
  const [ano, mes, dia] = texto.split("-").map(Number);
  return { ano, mes, dia };
}

export function validarNascimentoTitular(nascimento: string, agora = new Date()) {
  const iso = String(nascimento || "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return { ok: false as const, erro: "Informe a data de nascimento." };
  }
  const [ano, mes, dia] = iso.split("-").map(Number);
  const data = new Date(ano, mes - 1, dia);
  if (data.getFullYear() !== ano || data.getMonth() !== mes - 1 || data.getDate() !== dia) {
    return { ok: false as const, erro: "Informe uma data de nascimento válida." };
  }
  const hoje = hojeCivil(agora);
  if (ano > hoje.ano || (ano === hoje.ano && (mes > hoje.mes || (mes === hoje.mes && dia > hoje.dia)))) {
    return { ok: false as const, erro: "A data de nascimento não pode estar no futuro." };
  }
  let idade = hoje.ano - ano;
  if (hoje.mes < mes || (hoje.mes === mes && hoje.dia < dia)) idade -= 1;
  if (idade > 120) return { ok: false as const, erro: "Confira a data de nascimento." };
  if (idade < IDADE_MINIMA_CONTA) return { ok: false as const, erro: MENSAGEM_MENOR_DE_IDADE };
  return { ok: true as const, iso, idade };
}
