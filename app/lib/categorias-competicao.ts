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
  absoluto?: boolean; pagamento_ok?: boolean; status_checkin?: string | null;
};

export function normalizarCompeticao(valor: unknown) {
  return String(valor ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toUpperCase();
}

export function divisaoEtaria(idade: number) {
  if (!Number.isInteger(idade) || idade < 4 || idade > 100) throw new Error('Idade competitiva inválida (4 a 100 anos).');
  if (idade < 16) return `${idade} anos`;
  if (idade < 18) return 'Juvenil';
  if (idade < 30) return 'Adulto';
  return `Master ${Math.min(7, Math.floor((idade - 30) / 5) + 1)}`;
}

export function rotuloCategoria(c: CategoriaCompeticao) {
  const peso = c.tipo === 'absoluto' ? 'Absoluto' : c.peso_max == null ? `Acima de ${c.peso_min} kg` : `${c.peso_min} a ${c.peso_max} kg`;
  return `${c.modalidade} · ${c.nome} · ${c.idade_min}-${c.idade_max} anos · ${c.sexo} · ${c.faixa} · ${peso}`;
}

export function categoriaCompativel(c: CategoriaCompeticao, i: InscricaoCompeticao) {
  const idade = Number(i.idade), peso = Number(String(i.peso ?? '').replace(',', '.'));
  return c.ativa && i.idade !== '' && i.idade != null && Number.isInteger(idade)
    && idade >= c.idade_min && idade <= c.idade_max
    && normalizarCompeticao(i.sexo) === normalizarCompeticao(c.sexo)
    && normalizarCompeticao(i.faixa) === normalizarCompeticao(c.faixa)
    && (!i.modalidade || normalizarCompeticao(i.modalidade) === normalizarCompeticao(c.modalidade))
    && (c.tipo === 'absoluto' || (i.peso !== '' && i.peso != null && Number.isFinite(peso) && peso > c.peso_min && (c.peso_max == null || peso <= c.peso_max)));
}

export function validarCategoria(c: Omit<CategoriaCompeticao, 'id' | 'evento_id'>) {
  if (!c.nome.trim() || !c.modalidade.trim() || !c.faixa.trim() || !['Masculino', 'Feminino'].includes(c.sexo)) throw new Error('Informe nome, modalidade, sexo e faixa.');
  if (![c.idade_min, c.idade_max].every(Number.isInteger) || c.idade_min < 4 || c.idade_max > 100 || c.idade_min > c.idade_max) throw new Error('Confira o intervalo de idades.');
  if (!Number.isFinite(c.peso_min) || c.peso_min < 0 || (c.peso_max != null && (!Number.isFinite(c.peso_max) || c.peso_max <= c.peso_min))) throw new Error('Confira o intervalo de peso.');
  if (!Number.isFinite(c.tempo_minutos) || c.tempo_minutos < 1 || c.tempo_minutos > 30) throw new Error('O tempo deve ficar entre 1 e 30 minutos.');
}

/** Uma única composição para checagem, geração e conferência de inscritos legados. */
export function grupoInscricao(i: InscricaoCompeticao, tipo: 'peso' | 'absoluto', categorias: CategoriaCompeticao[] = []) {
  if (!i.faixa?.trim() || !['MASCULINO', 'FEMININO'].includes(normalizarCompeticao(i.sexo))) throw new Error('Faixa ou sexo competitivo não informado.');
  const divisao = divisaoEtaria(Number(i.idade));
  if (i.categoria_id && tipo === 'peso') {
    const c = categorias.find(c => c.id === i.categoria_id);
    if (!c || !categoriaCompativel(c, i)) throw new Error('Inscrição incompatível com a categoria cadastrada.');
    return { categoria: rotuloCategoria(c), faixa: c.faixa, categoria_id: c.id, tempo_minutos: c.tempo_minutos };
  }
  if (!i.categoria?.trim()) throw new Error('Categoria não informada.');
  const categoria = `${i.modalidade?.trim() || 'Jiu-Jitsu'} · ${tipo === 'absoluto' ? 'Absoluto' : i.categoria.trim()} · ${divisao} · ${i.sexo}`;
  return { categoria, faixa: i.faixa.trim(), categoria_id: null, tempo_minutos: null };
}
