/** Preserva o endereço autorizado, mas a identidade dos e-mails de fotos é sempre Retratt. */
export function remetenteEmailRetratt(configurado?: string) {
  const valor = configurado?.trim() || 'suporte@itatame.com.br';
  const endereco = valor.match(/<([^<>]+)>\s*$/)?.[1]?.trim() || valor;
  if (/[\r\n<>]/.test(endereco) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(endereco)) throw Error('Remetente Retratt inválido');
  return `Retratt <${endereco}>`;
}
