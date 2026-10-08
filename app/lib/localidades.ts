export type Localidade = { cidade: string; estado: string };

export function normalizarTextoLocalidade(valor: string) {
  return valor.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/\s+/g, " ");
}

export function chaveLocalidade(cidade: string, estado: string) {
  return `${normalizarTextoLocalidade(cidade)}|${estado.trim().toUpperCase()}`;
}

export function separarCidadeEstado(valor: string): Localidade {
  const partes = valor.trim().match(/^(.+?)\s*(?:\/|,|\s-\s)\s*([A-Z]{2})$/i);
  return partes ? { cidade: partes[1].trim(), estado: partes[2].toUpperCase() } : { cidade: valor.trim(), estado: "" };
}

export function cidadeComEstado(cidade: string, estado: string) {
  return estado ? `${cidade.trim()} / ${estado.trim().toUpperCase()}` : cidade.trim();
}
