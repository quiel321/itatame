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
  fase?: string | null;
};

export type ResultadoChave = {
  vencedorNome: string;
  vencedorEquipe?: string | null;
  vencedorId?: number | null;
  perdedorNome?: string | null;
  perdedorEquipe?: string | null;
  perdedorId?: number | null;
  propagarPerdedor?: boolean;
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
  const alimentadoras = todas.filter((item) => mesmaCategoria(item, luta) && String(item.proxima_luta) === String(luta.id_visual));

  // Na chave oficial de três atletas, a semifinal 2 recebe o perdedor da
  // semifinal 1. Portanto ela também depende dessa luta, embora o vencedor
  // da primeira semifinal avance diretamente para a final.
  if (String(luta.id_visual) === '2' && String(luta.fase || '').toUpperCase().includes('CHAVE DE 3')) {
    const semifinal1 = todas.find((item) =>
      mesmaCategoria(item, luta)
      && String(item.id_visual) === '1'
      && String(item.fase || '').toUpperCase().includes('CHAVE DE 3')
    );
    if (semifinal1 && !alimentadoras.some((item) => String(item.id) === String(semifinal1.id))) {
      alimentadoras.push(semifinal1);
    }
  }

  return alimentadoras;
}

function ladoDoDestino(luta: ChaveLutaAuto) {
  return Number(luta.id_visual || 0) % 2 !== 0 ? 'atleta_1' : 'atleta_2';
}

export async function propagarResultadoChave(
  supabase: SupabaseLike,
  todas: ChaveLutaAuto[],
  luta: ChaveLutaAuto,
  resultado: ResultadoChave,
) {
  const proxima = lutaDestino(todas, luta);
  if (proxima) {
    const lado = ladoDoDestino(luta);
    const updateData = lado === 'atleta_1'
      ? {
        atleta_1: resultado.vencedorNome,
        equipe_1: resultado.vencedorEquipe || '',
        atleta_1_id: resultado.vencedorId || null,
      }
      : {
        atleta_2: resultado.vencedorNome,
        equipe_2: resultado.vencedorEquipe || '',
        atleta_2_id: resultado.vencedorId || null,
      };

    const { error } = await supabase.from('chaves').update(updateData).eq('id', proxima.id);
    if (error) throw error;
  }

  const ehPrimeiraSemifinalDeTres = String(luta.id_visual) === '1'
    && String(luta.fase || '').toUpperCase().includes('CHAVE DE 3');

  if (ehPrimeiraSemifinalDeTres && resultado.propagarPerdedor !== false && isChaveAtletaReal(resultado.perdedorNome)) {
    const segundaSemifinal = todas.find((item) =>
      mesmaCategoria(item, luta)
      && String(item.id_visual) === '2'
      && String(item.fase || '').toUpperCase().includes('CHAVE DE 3')
    );

    if (segundaSemifinal) {
      const { error } = await supabase.from('chaves').update({
        atleta_1: resultado.perdedorNome,
        equipe_1: resultado.perdedorEquipe || '',
        atleta_1_id: resultado.perdedorId || null,
      }).eq('id', segundaSemifinal.id);
      if (error) throw error;
    }
  }
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
      metodo_vitoria: ladoVencedor === 'bye' ? 'avanco_direto' : 'wo',
      finalizada_em: new Date().toISOString(),
    })
    .eq('id', luta.id);

  await propagarResultadoChave(supabase, todas, luta, {
    vencedorNome: vencedorFinal,
    vencedorEquipe,
    vencedorId,
    propagarPerdedor: false,
  });
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
    const idsComAvanco = Array.from(new Set(todas.flatMap((luta) => [luta.atleta_1_id, luta.atleta_2_id]).filter(Boolean))) as number[];
    const { data: inscricoes } = idsComAvanco.length > 0
      ? await supabase.from('inscricoes').select('atleta_id, status_checkin').eq('evento_id', eventoId).in('atleta_id', idsComAvanco)
      : { data: [] };
    const checkinPorAtleta = new Map((inscricoes || []).map((item: any) => [Number(item.atleta_id), String(item.status_checkin || 'pendente')]));
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
        if (!luta.atleta_1_id || checkinPorAtleta.get(Number(luta.atleta_1_id)) !== 'aprovado') continue;
        await concluirWo(supabase, todas, luta, 'atleta_1');
        processouNestaRodada = true;
        houveAvanco = true;
        continue;
      }

      if (atleta2Real && atleta1Fantasma) {
        if (isChaveTbd(luta.atleta_1) && temAlimentadoraPendente) continue;
        if (!luta.atleta_2_id || checkinPorAtleta.get(Number(luta.atleta_2_id)) !== 'aprovado') continue;
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
