import { faixaEhLivre, faixasDaCategoria, normalizarCompeticao, type CategoriaCompeticao } from './categorias-competicao';

export type CategoriaValoresPublicos = Pick<CategoriaCompeticao,
  'tipo' | 'ativa' | 'modalidade' | 'sexo' | 'faixa' | 'idade_min' | 'idade_max' | 'peso_min' | 'peso_max'>;

// Só anuncia o combo quando existe um mesmo perfil aceito nas duas categorias.
// O limite inferior de peso é exclusivo, como na validação das inscrições.
export function existeComboCategorias(
  categorias: CategoriaValoresPublicos[], idadeMin = 4, idadeMax = 100,
) {
  const pesos = categorias.filter(c => c.ativa && c.tipo === 'peso');
  const absolutos = categorias.filter(c => c.ativa && c.tipo === 'absoluto');
  return pesos.some(peso => absolutos.some(absoluto => {
    if (normalizarCompeticao(peso.modalidade) !== normalizarCompeticao(absoluto.modalidade)
      || normalizarCompeticao(peso.sexo) !== normalizarCompeticao(absoluto.sexo)) return false;
    if (Math.max(peso.idade_min, absoluto.idade_min, idadeMin)
      > Math.min(peso.idade_max, absoluto.idade_max, idadeMax)) return false;
    const faixasPeso = faixasDaCategoria(peso.faixa).map(normalizarCompeticao);
    const faixasAbsoluto = faixasDaCategoria(absoluto.faixa).map(normalizarCompeticao);
    const faixaComum = faixaEhLivre(peso.faixa)
      ? faixaEhLivre(absoluto.faixa) || faixasAbsoluto.length > 0
      : faixaEhLivre(absoluto.faixa)
        ? faixasPeso.length > 0
        : faixasPeso.some(faixa => faixasAbsoluto.includes(faixa));
    return faixaComum && Math.max(peso.peso_min, absoluto.peso_min)
      < Math.min(peso.peso_max ?? Infinity, absoluto.peso_max ?? Infinity);
  }));
}
