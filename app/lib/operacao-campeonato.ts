type Resultado = { atleta_1?: string | null; atleta_2?: string | null; status_luta?: string | null; metodo_vitoria?: string | null; vencedor?: string | null; pontuacao_atleta_1?: Record<string, unknown> | null; pontuacao_atleta_2?: Record<string, unknown> | null };
export function atletaOperacional(nome?: string | null) {
  const n = String(nome || '').trim().toUpperCase();
  return Boolean(n) && !['BYE', 'TBD'].includes(n) && !n.includes('SEM OPONENTE');
}
export function resultadoOperacional(luta: Resultado) {
  if (luta.status_luta !== 'concluida') return 'pendente';
  if (luta.pontuacao_atleta_1?.recepcao_wo || luta.pontuacao_atleta_2?.recepcao_wo) return atletaOperacional(luta.vencedor) ? 'bye' : 'vazio';
  const reais = [luta.atleta_1, luta.atleta_2].filter(atletaOperacional).length;
  if (reais === 0) return 'vazio';
  if (reais === 1) return 'bye';
  return luta.metodo_vitoria === 'wo' ? 'wo' : 'combate';
}
export type InscritoCheckin = { id: number; user_id: string; categoria_id?: string | null; atleta_id?: number | null; atleta: string; equipe?: string | null; categoria?: string | null; faixa?: string | null; pagamento_ok?: boolean | null; status_checkin?: string | null; pesagem_ok?: boolean | null; kimono_aprovado?: boolean | null; tatames?: string[] };
export type ChaveCheckin = { categoria: string; categoria_id?: string | null; tatame?: string | null; ordem_tatame?: number | null; atleta_1_id?: number | null; atleta_2_id?: number | null };
export function todasCategoriasRecepcaoFinalizadas(lista: InscritoCheckin[], chaves: ChaveCheckin[], categoriasFechadas: string[]) {
  // Usa o evento inteiro: filtros da tela e atletas já pesados não encerram categorias.
  const participantes = lista.filter(i => i.pagamento_ok);
  const categorias = new Set([...participantes, ...chaves].map(i => i.categoria_id));
  if (!categorias.size || categorias.has(null) || categorias.has(undefined) || categorias.has('')) return false;
  const fechadas = new Set(categoriasFechadas);
  return [...categorias].every(id => fechadas.has(id!));
}
export function categoriasRecepcaoOrdenadas(lista: InscritoCheckin[], chaves: ChaveCheckin[]) {
  return [...new Set(lista.map(i => i.categoria || 'Sem categoria'))].map(nome => {
    const primeira = chaves.filter(c => c.categoria === nome && c.tatame && c.ordem_tatame != null && c.ordem_tatame > 0)
      .sort((a,b) => a.tatame!.localeCompare(b.tatame!, 'pt-BR', {numeric:true}) || a.ordem_tatame! - b.ordem_tatame!)[0];
    return { nome, tatame: primeira?.tatame || '', ordem: primeira?.ordem_tatame ?? Infinity };
  }).sort((a,b) => Number(!a.tatame)-Number(!b.tatame) || a.tatame.localeCompare(b.tatame,'pt-BR',{numeric:true}) || a.ordem-b.ordem || a.nome.localeCompare(b.nome,'pt-BR'));
}
export function listaCheckinPorChave(lista: InscritoCheckin[], chaves: ChaveCheckin[]) {
  return lista.flatMap(i => {
    const categorias = new Map<string, Set<string>>();
    for (const luta of chaves) {
      if (!i.atleta_id || ![luta.atleta_1_id,luta.atleta_2_id].includes(i.atleta_id)) continue;
      if (i.categoria_id && luta.categoria_id && i.categoria_id !== luta.categoria_id) continue;
      const areas = categorias.get(luta.categoria) || new Set<string>();
      if (luta.tatame) areas.add(luta.tatame);
      categorias.set(luta.categoria,areas);
    }
    return categorias.size ? Array.from(categorias,([categoria,areas]) => ({...i,categoria,tatames:Array.from(areas)})) : [i];
  });
}
export function filtrarCheckin(lista: InscritoCheckin[], busca: string, categoria: string) {
  const normalizar = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const termo = normalizar(busca);
  return lista.filter(i => (!categoria || (i.categoria || 'Sem categoria') === categoria) && (!termo || normalizar(`${i.atleta} ${i.equipe || ''}`).includes(termo) || String(i.id) === termo.replace(/^#/, '')));
}
