export type CategoriaCompeticao = {
  id: string; evento_id: string; nome: string; modalidade: string;
  sexo: string; faixa: string; idade_min: number; idade_max: number;
  peso_min: number; peso_max: number | null; tempo_minutos: number;
  tipo: 'peso' | 'absoluto'; ativa: boolean;
};

export type InscricaoCompeticao = {
  id?: string | number; atleta?: string; nome?: string; atleta_id?: number | null;
  categoria?: string | null; categoria_id?: string | null; faixa?: string | null;
  sexo?: string | null; idade?: string | number | null; peso?: string | number | null;
  modalidade?: string | null; equipe?: string | null; equipe_id?: string | null;
  academia?: string | null; user_id?: string | null;
  absoluto?: boolean; pagamento_ok?: boolean; status_checkin?: string | null;
};

export function normalizarCompeticao(valor: unknown) {
  return String(valor ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toUpperCase();
}

export function semFaixaDuplicada(categoria: string, faixa: string) {
  return categoria.split('·').map(parte => parte.trim())
    .filter(parte => normalizarCompeticao(parte) !== normalizarCompeticao(faixa))
    .join(' · ');
}

export function dataCompeticao(valor?: string | Date | null) {
  if (!valor) return null;
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor;
  const texto = String(valor).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return null;
  const data = new Date(`${texto}T12:00:00`);
  return Number.isNaN(data.getTime()) ? null : data;
}

export function idadeCompetitiva(nascimento?: string | Date | null, referencia?: string | Date | null) {
  const nasc = dataCompeticao(nascimento);
  const ref = dataCompeticao(referencia) || new Date();
  if (!nasc) return NaN;
  let idade = ref.getFullYear() - nasc.getFullYear();
  const mes = ref.getMonth() - nasc.getMonth();
  if (mes < 0 || (mes === 0 && ref.getDate() < nasc.getDate())) idade--;
  return idade;
}

export function divisaoEtaria(idade: number) {
  if (!Number.isInteger(idade) || idade < 4 || idade > 100) throw new Error('Idade competitiva inválida (4 a 100 anos).');
  if (idade < 16) return `${idade} anos`;
  if (idade < 18) return 'Juvenil';
  if (idade < 30) return 'Adulto';
  return `Master ${Math.min(7, Math.floor((idade - 30) / 5) + 1)}`;
}

export function categoriaPesoLivre(c: Pick<CategoriaCompeticao, 'peso_min' | 'peso_max' | 'tipo'>) {
  return c.tipo === 'absoluto' && !(Number(c.peso_min) > 0) && c.peso_max == null;
}

export function pesoNaFaixaCategoria(c: Pick<CategoriaCompeticao, 'peso_min' | 'peso_max'>, i: Pick<InscricaoCompeticao, 'peso'>) {
  const peso = Number(String(i.peso ?? '').replace(',', '.'));
  return i.peso !== '' && i.peso != null && Number.isFinite(peso) && peso > c.peso_min && (c.peso_max == null || peso <= c.peso_max);
}

export function rotuloPesoCategoria(c: CategoriaCompeticao) {
  const faixaPeso = c.peso_max == null ? `Acima de ${c.peso_min} kg` : `${c.peso_min} a ${c.peso_max} kg`;
  if (c.tipo === 'absoluto' && categoriaPesoLivre(c)) return 'Absoluto';
  if (c.tipo === 'absoluto') return `Absoluto · ${faixaPeso}`;
  return faixaPeso;
}

export function rotuloCategoria(c: CategoriaCompeticao) {
  const faixa = faixaEhLivre(c.faixa) ? FAIXA_TODAS_AS_FAIXAS : (faixasDaCategoria(c.faixa).join(' · ') || c.faixa);
  return [c.modalidade, semFaixaDuplicada(c.nome, faixa), faixa, `${c.idade_min}-${c.idade_max} anos`, c.sexo, rotuloPesoCategoria(c)]
    .filter(Boolean).join(' · ');
}

export function categoriaCompativelSemPeso(c: CategoriaCompeticao, i: InscricaoCompeticao) {
  const idade = Number(i.idade);
  return c.ativa && i.idade !== '' && i.idade != null && Number.isInteger(idade)
    && idade >= c.idade_min && idade <= c.idade_max
    && normalizarCompeticao(i.sexo) === normalizarCompeticao(c.sexo)
    && normalizarCompeticao(i.faixa) === normalizarCompeticao(c.faixa)
    && (!i.modalidade || normalizarCompeticao(i.modalidade) === normalizarCompeticao(c.modalidade));
}

export function categoriaCompativel(c: CategoriaCompeticao, i: InscricaoCompeticao) {
  return categoriaCompativelSemPeso(c, i)
    && (c.tipo === 'absoluto' || pesoNaFaixaCategoria(c, i));
}

/** Sem categoria de origem estruturada, exige nova medição para qualquer migração. */
export function categoriaMaisLeve(atual: CategoriaCompeticao | null, destino: CategoriaCompeticao) {
  if (atual) return (destino.peso_max ?? Infinity) < (atual.peso_max ?? Infinity);
  return true;
}

export const FAIXA_TODAS_AS_FAIXAS = 'Todas as faixas';
const ORDEM_FAIXAS = ['Cinza', 'Amarela', 'Laranja', 'Verde', 'Branca', 'Azul', 'Roxa', 'Marrom', 'Preta', 'Coral', 'Vermelha'];

export function faixaEhLivre(faixa?: string | null) {
  const n = normalizarCompeticao(faixa);
  return n === 'TODAS' || n === 'TODAS AS FAIXAS' || n === 'TODAS FAIXAS' || n === 'LIVRE';
}

export function faixasDaCategoria(faixa?: string | null) {
  if (faixaEhLivre(faixa)) return [] as string[];
  return String(faixa || '')
    .split(/[,/·;]+/)
    .map(item => item.trim())
    .filter(Boolean);
}

export function serializarFaixasCategoria(faixas: string[], todas = false) {
  if (todas || faixas.some(faixa => faixaEhLivre(faixa))) return FAIXA_TODAS_AS_FAIXAS;
  const unicas = [...new Map(
    faixas
      .map(item => item.trim())
      .filter(item => item.length > 0)
      .map((item): [string, string] => [normalizarCompeticao(item), item]),
  ).values()];
  unicas.sort((a, b) => {
    const ia = ORDEM_FAIXAS.findIndex(item => normalizarCompeticao(item) === normalizarCompeticao(a));
    const ib = ORDEM_FAIXAS.findIndex(item => normalizarCompeticao(item) === normalizarCompeticao(b));
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b, 'pt-BR');
  });
  if (!unicas.length) throw new Error('Escolha ao menos uma faixa para o absoluto.');
  return unicas.join(' · ');
}

export function faixaAtletaCompativel(faixaCategoria: string, faixaAtleta?: string | null) {
  if (faixaEhLivre(faixaCategoria)) return true;
  const permitidas = faixasDaCategoria(faixaCategoria);
  const atleta = normalizarCompeticao(faixaAtleta);
  return permitidas.some(faixa => normalizarCompeticao(faixa) === atleta);
}

export function categoriaAbsolutoCompativel(c: CategoriaCompeticao, i: InscricaoCompeticao) {
  if (!c.ativa || c.tipo !== 'absoluto') return false;
  const idade = Number(i.idade);
  if (i.idade === '' || i.idade == null || !Number.isInteger(idade)) return false;
  if (idade < c.idade_min || idade > c.idade_max) return false;
  if (normalizarCompeticao(i.sexo) !== normalizarCompeticao(c.sexo)) return false;
  if (i.modalidade && normalizarCompeticao(i.modalidade) !== normalizarCompeticao(c.modalidade)) return false;
  if (!faixaAtletaCompativel(c.faixa, i.faixa)) return false;
  return categoriaPesoLivre(c) || pesoNaFaixaCategoria(c, i);
}

export function absolutoDaInscricao(i: InscricaoCompeticao, categorias: CategoriaCompeticao[]) {
  const candidatas = categorias.filter(c => categoriaAbsolutoCompativel(c, i));
  candidatas.sort((a, b) => {
    const amplitude = (faixa: string) => faixaEhLivre(faixa) ? 1000 : Math.max(1, faixasDaCategoria(faixa).length);
    const livre = amplitude(a.faixa) - amplitude(b.faixa);
    if (livre) return livre;
    return (a.idade_max - a.idade_min) - (b.idade_max - b.idade_min);
  });
  return candidatas[0] || null;
}

export function validarCategoria(c: Omit<CategoriaCompeticao, 'id' | 'evento_id'>) {
  if (!['peso', 'absoluto'].includes(c.tipo)) throw new Error('Informe se a categoria é de peso ou absoluto.');
  if (!c.nome.trim() || !c.modalidade.trim() || !c.faixa.trim() || !['Masculino', 'Feminino'].includes(c.sexo)) throw new Error('Informe nome, modalidade, sexo e faixa.');
  if (c.tipo === 'peso' && (faixaEhLivre(c.faixa) || faixasDaCategoria(c.faixa).length !== 1)) throw new Error('Categoria de peso precisa de uma faixa específica.');
  if (c.tipo === 'absoluto' && !faixaEhLivre(c.faixa) && !faixasDaCategoria(c.faixa).length) throw new Error('Escolha as faixas que entram neste absoluto.');
  if (![c.idade_min, c.idade_max].every(Number.isInteger) || c.idade_min < 4 || c.idade_max > 100 || c.idade_min > c.idade_max) throw new Error('Confira o intervalo de idades.');
  if (!Number.isFinite(c.peso_min) || c.peso_min < 0 || (c.peso_max != null && (!Number.isFinite(c.peso_max) || c.peso_max <= c.peso_min))) throw new Error('Confira o intervalo de peso.');
  if (!Number.isFinite(c.tempo_minutos) || c.tempo_minutos < 1 || c.tempo_minutos > 30) throw new Error('O tempo deve ficar entre 1 e 30 minutos.');
}

export function inscricaoSoAbsoluto(i: Pick<InscricaoCompeticao, 'absoluto' | 'categoria'>) {
  return i.absoluto === true && String(i.categoria || '').trim().toLowerCase() === 'absoluto';
}

export type ChaveChecagem = {
  tipo: 'peso' | 'absoluto';
  chave: string;
  rotulo: string;
};

export function chaveDoGrupo(grupo: { categoria: string; faixa: string; categoria_id?: string | null }) {
  return grupo.categoria_id || `${grupo.categoria}__${grupo.faixa}`;
}

/** Só categorias cadastradas pelo organizador: peso e/ou absoluto. */
export function chavesDaInscricao(i: InscricaoCompeticao, categorias: CategoriaCompeticao[]): ChaveChecagem[] {
  const chaves: ChaveChecagem[] = [];
  if (!inscricaoSoAbsoluto(i)) {
    try {
      const grupo = grupoInscricao(i, 'peso', categorias);
      chaves.push({ tipo: 'peso', chave: `peso:${chaveDoGrupo(grupo)}`, rotulo: grupo.categoria });
    } catch { /* sem categoria de peso do organizador */ }
  }
  if (i.absoluto) {
    try {
      const grupo = grupoInscricao(i, 'absoluto', categorias);
      chaves.push({ tipo: 'absoluto', chave: `abs:${chaveDoGrupo(grupo)}`, rotulo: grupo.categoria });
    } catch { /* sem absoluto cadastrado que aceite este atleta */ }
  }
  return chaves;
}

/** Uma única composição para checagem, geração e conferência de inscritos legados. */
export function grupoInscricao(i: InscricaoCompeticao, tipo: 'peso' | 'absoluto', categorias: CategoriaCompeticao[] = []) {
  if (!i.faixa?.trim() || !['MASCULINO', 'FEMININO'].includes(normalizarCompeticao(i.sexo))) throw new Error('Faixa ou sexo competitivo não informado.');
  if (tipo === 'absoluto') {
    const c = absolutoDaInscricao(i, categorias);
    if (!c) throw new Error('Este atleta não se enquadra em absoluto cadastrado pelo organizador.');
    return { categoria: rotuloCategoria(c), faixa: c.faixa, categoria_id: c.id, tempo_minutos: c.tempo_minutos };
  }
  if (inscricaoSoAbsoluto(i)) throw new Error('Inscrição só de absoluto não entra na chave de peso.');
  if (i.categoria_id) {
    const c = categorias.find(c => c.id === i.categoria_id);
    if (!c || c.tipo !== 'peso') throw new Error('Inscrição incompatível com a categoria cadastrada.');
    return { categoria: rotuloCategoria(c), faixa: c.faixa, categoria_id: c.id, tempo_minutos: c.tempo_minutos };
  }
  if (!i.categoria?.trim()) throw new Error('Categoria não informada.');
  const alvo = normalizarCompeticao(i.categoria);
  const cadastrada = categorias.find(c => {
    if (c.tipo !== 'peso' || !c.ativa) return false;
    const mesmoRotulo = normalizarCompeticao(rotuloCategoria(c)) === alvo;
    const mesmoNome = normalizarCompeticao(c.nome) === alvo;
    return mesmoRotulo || (mesmoNome && categoriaCompativel(c, i));
  });
  if (cadastrada) {
    return { categoria: rotuloCategoria(cadastrada), faixa: cadastrada.faixa, categoria_id: cadastrada.id, tempo_minutos: cadastrada.tempo_minutos };
  }
  throw new Error('Este atleta não se enquadra em categoria de peso cadastrada pelo organizador.');
}
