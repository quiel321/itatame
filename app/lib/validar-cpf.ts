export function somenteDigitosCpf(valor?: string | null) {
  return String(valor || "").replace(/\D/g, "");
}

export function formatarCpf(valor?: string | null) {
  return somenteDigitosCpf(valor)
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

/**
 * Confere os dois digitos verificadores da Receita Federal e recusa sequencias
 * repetidas (000.000.000-00, 111.111.111-11 ...), que passam no calculo.
 */
export function cpfValido(valor?: string | null) {
  const cpf = somenteDigitosCpf(valor);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  const digitoVerificador = (quantidade: number) => {
    let soma = 0;
    for (let i = 0; i < quantidade; i += 1) soma += Number(cpf[i]) * (quantidade + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  return digitoVerificador(9) === Number(cpf[9]) && digitoVerificador(10) === Number(cpf[10]);
}

/** Variantes gravadas no banco (com e sem mascara) para checar duplicidade. */
export function variantesCpf(valor?: string | null) {
  const digitos = somenteDigitosCpf(valor);
  return digitos.length === 11 ? [digitos, formatarCpf(digitos)] : [digitos];
}
