import { faixaAtletaCompativel, normalizarCompeticao, pesoNaFaixaCategoria, type CategoriaCompeticao, type InscricaoCompeticao } from './categorias-competicao';

export function categoriaPermitidaAoOrganizador(categoria: CategoriaCompeticao, inscricao: InscricaoCompeticao) {
  return categoria.ativa && categoria.tipo === 'peso'
    && normalizarCompeticao(categoria.sexo) === normalizarCompeticao(inscricao.sexo)
    && faixaAtletaCompativel(categoria.faixa, inscricao.faixa)
    && (!inscricao.modalidade || normalizarCompeticao(categoria.modalidade) === normalizarCompeticao(inscricao.modalidade));
}

export function divergenciasCategoria(categoria: CategoriaCompeticao, inscricao: InscricaoCompeticao) {
  const idade = Number(inscricao.idade);
  return {
    idade: !Number.isInteger(idade) || idade < categoria.idade_min || idade > categoria.idade_max,
    peso: !pesoNaFaixaCategoria(categoria, inscricao),
  };
}
