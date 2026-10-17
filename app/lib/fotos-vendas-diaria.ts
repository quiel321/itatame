export type VendaFotografoDiaria = {
  fotografoId: string; nome: string; quantidade: number; subtotalCentavos: number;
  descontoCentavos: number; totalCentavos: number; comissaoRetrattCentavos: number; antesTarifaCentavos: number;
};
export type ResumoFotografoDiaria = VendaFotografoDiaria & { galeriaId: string; galeria: string; pedidosPagos: number };
type ItemAutoria = { fotografoId: string; nome: string; precoCentavos: number; mimeType?: string | null };

function centavos(valor: number) {
  if (!Number.isSafeInteger(valor) || valor < 0) throw new Error('Valor financeiro inválido na conferência das vendas.');
  return valor;
}

/** Rateio proporcional com os maiores restos: conserva todos os centavos. */
export function ratearCentavos(valor: number, pesos: number[]): number[] {
  centavos(valor); pesos.forEach(centavos);
  const soma = pesos.reduce((a, b) => a + b, 0); centavos(soma);
  if (!soma) {
    if (valor) throw new Error('Não há base para ratear o valor.');
    return pesos.map(() => 0);
  }
  const divisor = BigInt(soma), total = BigInt(valor);
  const partes = pesos.map((peso, indice) => ({ indice, valor: Number(total * BigInt(peso) / divisor), resto: total * BigInt(peso) % divisor }));
  let faltam = valor - partes.reduce((a, b) => a + b.valor, 0);
  for (const parte of [...partes].sort((a, b) => a.resto === b.resto ? a.indice - b.indice : a.resto > b.resto ? -1 : 1)) {
    if (!faltam) break;
    parte.valor++; faltam--;
  }
  return partes.map(p => p.valor);
}

/** Somente os vínculos confiáveis lidos no servidor podem definir o recebedor. */
export function modeloCheckoutAutores(organizadorId: string | null, autores: string[], vinculos: { fotografo_id: string; status: string; modelo_recebimento: string | null }[]) {
  const ids = [...new Set(autores)];
  if (!ids.length || ids.some(id => !id || id === 'null' || id === 'undefined')) throw new Error('Autoria de um ou mais arquivos indisponível.');
  if (!organizadorId) {
    if (ids.length > 1) throw new Error('Estas fotos precisam ser compradas separadamente por fotógrafo. Finalize as fotos de um fotógrafo e depois as do outro.');
    return 'royalty' as const;
  }
  const regras = ids.map(id => vinculos.find(v => v.fotografo_id === id));
  if (regras.some(v => !v || v.status !== 'ativo')) throw new Error('Um dos fotógrafos não está credenciado para vender nesta galeria.');
  if (ids.length > 1 && regras.some(v => v!.modelo_recebimento !== 'diaria_organizador')) {
    throw new Error('Estas fotos precisam ser compradas separadamente por fotógrafo. Finalize as fotos de um fotógrafo e depois as do outro.');
  }
  return regras[0]!.modelo_recebimento === 'diaria_organizador' ? 'diaria_organizador' as const : 'royalty' as const;
}

/** Guarda autoria, preço, desconto e comissão no momento da compra, sem depender de regras futuras. */
export function registrarVendasFotografos(itens: ItemAutoria[], desconto: number, comissao: number): VendaFotografoDiaria[] {
  centavos(desconto); centavos(comissao);
  const grupos = new Map<string, { nome: string; quantidade: number; bruto: number; elegivel: number }>();
  for (const item of itens) {
    if (!item.fotografoId) throw new Error('Autoria indisponível na conferência das vendas.');
    centavos(item.precoCentavos);
    const grupo = grupos.get(item.fotografoId) || { nome: item.nome || 'Fotógrafo', quantidade: 0, bruto: 0, elegivel: 0 };
    grupo.quantidade++; grupo.bruto += item.precoCentavos;
    if (!item.mimeType?.startsWith('video/')) grupo.elegivel += item.precoCentavos;
    grupos.set(item.fotografoId, grupo);
  }
  const lista = [...grupos].sort(([a], [b]) => a.localeCompare(b));
  if (desconto > lista.reduce((s, [, g]) => s + g.elegivel, 0)) throw new Error('Desconto divergente na conferência das vendas.');
  const descontos = ratearCentavos(desconto, lista.map(([, g]) => g.elegivel));
  const totais = lista.map(([, g], n) => g.bruto - descontos[n]);
  if (comissao > totais.reduce((s, v) => s + v, 0)) throw new Error('Comissão divergente na conferência das vendas.');
  const comissoes = ratearCentavos(comissao, totais);
  return lista.map(([fotografoId, g], n) => ({ fotografoId, nome: g.nome, quantidade: g.quantidade,
    subtotalCentavos: g.bruto, descontoCentavos: descontos[n], totalCentavos: totais[n],
    comissaoRetrattCentavos: comissoes[n], antesTarifaCentavos: totais[n] - comissoes[n] }));
}

export function conferirRegistroVendas(registro: unknown, total: number, comissao: number): VendaFotografoDiaria[] {
  if (!Array.isArray(registro) || !registro.length) throw new Error('Registro de autoria das vendas indisponível.');
  const ids = new Set<string>();
  for (const venda of registro) {
    if (!venda || typeof venda.fotografoId !== 'string' || !venda.fotografoId || ids.has(venda.fotografoId) || typeof venda.nome !== 'string') throw new Error('Autoria divergente no registro de vendas.');
    ids.add(venda.fotografoId);
    for (const campo of ['quantidade', 'subtotalCentavos', 'descontoCentavos', 'totalCentavos', 'comissaoRetrattCentavos', 'antesTarifaCentavos']) centavos(venda[campo]);
    if (!venda.quantidade || venda.subtotalCentavos - venda.descontoCentavos !== venda.totalCentavos || venda.totalCentavos - venda.comissaoRetrattCentavos !== venda.antesTarifaCentavos) throw new Error('Valores divergentes no registro de vendas.');
  }
  if (registro.reduce((s, v) => s + v.totalCentavos, 0) !== total || registro.reduce((s, v) => s + v.comissaoRetrattCentavos, 0) !== comissao) throw new Error('Totais divergentes no registro de vendas.');
  return registro;
}
