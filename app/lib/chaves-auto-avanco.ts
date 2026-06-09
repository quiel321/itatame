type SupabaseLike = {
  from: (table: string) => any;
};

export type ChaveLutaAuto = {
  id: string | number;
  evento_id: string | number;
  categoria: string;
  faixa: string;
  id_visual?: string | number | null;
  proxima_luta?: string | number | null;
  tatame?: string | null;
  atleta_1?: string | null;
  atleta_2?: string | null;
  equipe_1?: string | null;
  equipe_2?: string | null;
  atleta_1_id?: number | null;
  atleta_2_id?: number | null;
  status_luta?: string | null;
  vencedor?: string | null;
};

export function normalizarChaveNome(value?: string | null) {
  return String(value || '').trim().toUpperCase();
}

export function isChaveTbd(nome?: string | null) {
  const clean = normalizarChaveNome(nome);
  return clean === '' || clean === 'TBD';
}

export function isChaveFantasma(nome?: string | null) {
  const clean = normalizarChaveNome(nome);
  return clean === '' || clean === 'BYE' || clean === 'TBD' || clean.includes('SEM OPONENTE');
}

export function isChaveAtletaReal(nome?: string | null) {
  return !isChaveFantasma(nome);
}

function statusConcluido(luta: ChaveLutaAuto) {
  return luta.status_luta === 'concluida' || Boolean(luta.vencedor);
}

function mesmaCategoria(a: ChaveLutaAuto, b: ChaveLutaAuto) {
  return a.categoria === b.categoria && a.faixa === b.faixa;
}

function lutaDestino(todas: ChaveLutaAuto[], luta: ChaveLutaAuto) {
  if (!luta.proxima_luta) return null;
  return todas.find((item) => mesmaCategoria(item, luta) && String(item.id_visual) === String(luta.proxima_luta)) || null;
}

function lutasQueAlimentam(todas: ChaveLutaAuto[], luta: ChaveLutaAuto) {
  return todas.filter((item) => mesmaCategoria(item, luta) && String(item.proxima_luta) === String(luta.id_visual));
}

function ladoDoDestino(luta: ChaveLutaAuto) {
  return Number(luta.id_visual || 0) % 2 !== 0 ? 'atleta_1' : 'atleta_2';
}

async function concluirWo(supabase: SupabaseLike, todas: ChaveLutaAuto[], luta: ChaveLutaAuto, ladoVencedor: 'atleta_1' | 'atleta_2' | 'bye') {
  const vencedorNome = ladoVencedor === 'atleta_1' ? luta.atleta_1 : ladoVencedor === 'atleta_2' ? luta.atleta_2 : 'BYE';
  const vencedorEquipe = ladoVencedor === 'atleta_1' ? luta.equipe_1 : ladoVencedor === 'atleta_2' ? luta.equipe_2 : '';
  const vencedorId = ladoVencedor === 'atleta_1' ? luta.atleta_1_id : ladoVencedor === 'atleta_2' ? luta.atleta_2_id : null;
  const vencedorFinal = vencedorNome || 'BYE';

  await supabase
    .from('chaves')
    .update({
      status_luta: 'concluida',
      vencedor: vencedorFinal,
      vencedor_id: vencedorId || null,
      metodo_vitoria: 'wo',
      finalizada_em: new Date().toISOString(),
    })
    .eq('id', luta.id);

  const proxima = lutaDestino(todas, luta);
  if (!proxima) return;

  const lado = ladoDoDestino(luta);
  const updateData = lado === 'atleta_1'
    ? {
      atleta_1: vencedorFinal,
      equipe_1: vencedorEquipe || '',
      atleta_1_id: vencedorId || null,
      tatame: luta.tatame || proxima.tatame || null,
    }
    : {
      atleta_2: vencedorFinal,
      equipe_2: vencedorEquipe || '',
      atleta_2_id: vencedorId || null,
      tatame: luta.tatame || proxima.tatame || null,
    };

  await supabase.from('chaves').update(updateData).eq('id', proxima.id);
}

export async function processarAvancosAutomaticosChaves(supabase: SupabaseLike, eventoId: string | number) {
  let houveAvanco = false;

  for (let rodada = 0; rodada < 20; rodada++) {
    const { data, error } = await supabase
      .from('chaves')
      .select('*')
      .eq('evento_id', eventoId);

    if (error || !data) return houveAvanco;

    const todas = data as ChaveLutaAuto[];
    let processouNestaRodada = false;

    for (const luta of todas) {
      if (statusConcluido(luta)) continue;

      const alimentadoras = lutasQueAlimentam(todas, luta);
      const temAlimentadoraPendente = alimentadoras.some((item) => !statusConcluido(item));
      const atleta1Real = isChaveAtletaReal(luta.atleta_1);
      const atleta2Real = isChaveAtletaReal(luta.atleta_2);
      const atleta1Fantasma = isChaveFantasma(luta.atleta_1);
      const atleta2Fantasma = isChaveFantasma(luta.atleta_2);

      if (atleta1Real && atleta2Fantasma) {
        if (isChaveTbd(luta.atleta_2) && temAlimentadoraPendente) continue;
        await concluirWo(supabase, todas, luta, 'atleta_1');
        processouNestaRodada = true;
        houveAvanco = true;
        continue;
      }

      if (atleta2Real && atleta1Fantasma) {
        if (isChaveTbd(luta.atleta_1) && temAlimentadoraPendente) continue;
        await concluirWo(supabase, todas, luta, 'atleta_2');
        processouNestaRodada = true;
        houveAvanco = true;
        continue;
      }

      if (atleta1Fantasma && atleta2Fantasma) {
        if (temAlimentadoraPendente) continue;
        await concluirWo(supabase, todas, luta, 'bye');
        processouNestaRodada = true;
        houveAvanco = true;
      }
    }

    if (!processouNestaRodada) break;
  }

  return houveAvanco;
}
