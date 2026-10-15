import { ehFaseChaveDeTres, idBaiaDaPrimeiraChaveDeTres } from '@/app/lib/chave-de-tres';

type SupabaseLike = {
  from: (table: string) => any;
  rpc?: (nome: string, parametros: Record<string, unknown>) => any;
};

export type ChaveLutaAuto = {
  id: string | number;
  evento_id: string | number;
  categoria: string;
  categoria_id?: string | null;
  faixa: string;
  id_visual?: string | number | null;
  proxima_luta?: string | number | null;
  tatame?: string | null;
  ordem_tatame?: number | null;
  atleta_1?: string | null;
  atleta_2?: string | null;
  equipe_1?: string | null;
  equipe_2?: string | null;
  atleta_1_id?: number | null;
  atleta_2_id?: number | null;
  vencedor_id?: number | null;
  status_luta?: string | null;
  vencedor?: string | null;
  fase?: string | null;
  metodo_vitoria?: string | null;
  pontuacao_atleta_1?: Record<string, unknown> | null;
  pontuacao_atleta_2?: Record<string, unknown> | null;
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

export function isChaveBye(nome?: string | null) {
  const clean = normalizarChaveNome(nome);
  return clean === 'BYE' || clean.includes('SEM OPONENTE');
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

  // Na chave de 3 (e nos dois lados da chave de 6), a baia recebe o perdedor
  // da primeira luta daquele lado.
  const idPrimeira = String(luta.id_visual) === '2' ? '1' : String(luta.id_visual) === '4' ? '3' : null;
  if (idPrimeira) {
    const primeira = todas.find((item) =>
      mesmaCategoria(item, luta)
      && String(item.id_visual) === idPrimeira
      && ehFaseChaveDeTres(item.fase)
    );
    if (primeira && !alimentadoras.some((item) => String(item.id) === String(primeira.id))) {
      alimentadoras.push(primeira);
    }
  }

  return alimentadoras;
}

function contarAtletasReaisNaChave(todas: ChaveLutaAuto[], luta: ChaveLutaAuto) {
  const vistos = new Set<string>();
  for (const item of todas) {
    if (!mesmaCategoria(item, luta)) continue;
    for (const [nome, id] of [[item.atleta_1, item.atleta_1_id], [item.atleta_2, item.atleta_2_id]] as const) {
      if (!isChaveAtletaReal(nome)) continue;
      vistos.add(id ? `ID:${id}` : `NOME:${normalizarChaveNome(nome)}`);
    }
  }
  return vistos.size;
}

function sozinhoNaChave(todas: ChaveLutaAuto[], luta: ChaveLutaAuto) {
  return contarAtletasReaisNaChave(todas, luta) <= 1;
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

    const extraFila: Record<string, unknown> = {};
    if (!proxima.tatame && luta.tatame) extraFila.tatame = luta.tatame;
    if (!proxima.ordem_tatame && luta.ordem_tatame) extraFila.ordem_tatame = Number(luta.ordem_tatame) + 1;

    const { error } = await supabase.from('chaves').update({ ...updateData, ...extraFila }).eq('id', proxima.id);
    if (error) throw error;
  }

  const idBaia = idBaiaDaPrimeiraChaveDeTres(luta.id_visual, luta.fase);

  if (idBaia && resultado.propagarPerdedor !== false && isChaveAtletaReal(resultado.perdedorNome)) {
    const lutaBaia = todas.find((item) =>
      mesmaCategoria(item, luta)
      && String(item.id_visual) === idBaia
      && ehFaseChaveDeTres(item.fase)
    );

    if (lutaBaia) {
      const extraBaia: Record<string, unknown> = {};
      if (!lutaBaia.tatame && luta.tatame) extraBaia.tatame = luta.tatame;
      if (!lutaBaia.ordem_tatame && luta.ordem_tatame) extraBaia.ordem_tatame = Number(luta.ordem_tatame) + 1;
      const { error } = await supabase.from('chaves').update({
        atleta_1: resultado.perdedorNome,
        equipe_1: resultado.perdedorEquipe || '',
        atleta_1_id: resultado.perdedorId || null,
        ...extraBaia,
      }).eq('id', lutaBaia.id);
      if (error) throw error;
    }
  }
}

async function concluirWo(supabase: SupabaseLike, todas: ChaveLutaAuto[], luta: ChaveLutaAuto, ladoVencedor: 'atleta_1' | 'atleta_2' | 'bye') {
  const vencedorNome = ladoVencedor === 'atleta_1' ? luta.atleta_1 : ladoVencedor === 'atleta_2' ? luta.atleta_2 : 'BYE';
  const vencedorEquipe = ladoVencedor === 'atleta_1' ? luta.equipe_1 : ladoVencedor === 'atleta_2' ? luta.equipe_2 : '';
  const vencedorId = ladoVencedor === 'atleta_1' ? luta.atleta_1_id : ladoVencedor === 'atleta_2' ? luta.atleta_2_id : null;
  const vencedorFinal = vencedorNome || 'BYE';

  let registro = supabase
    .from('chaves')
    .update({
      status_luta: 'concluida',
      vencedor: vencedorFinal,
      vencedor_id: vencedorId || null,
      metodo_vitoria: 'wo',
      finalizada_em: new Date().toISOString(),
    })
    .eq('id', luta.id).eq('evento_id', luta.evento_id).neq('status_luta', 'concluida').neq('status_luta', 'em_andamento');
  for (const campo of ['atleta_1', 'atleta_2'] as const) {
    registro = luta[campo] == null ? registro.is(campo, null) : registro.eq(campo, luta[campo]);
  }
  const { data: atualizadas, error } = await registro.select('id');
  if (error) throw error;
  if (!atualizadas?.length) return false;

  await propagarResultadoChave(supabase, todas, luta, {
    vencedorNome: vencedorFinal,
    vencedorEquipe,
    vencedorId,
    propagarPerdedor: false,
  });
  return true;
}

async function reabrirWoSemChecagem(supabase: SupabaseLike, todas: ChaveLutaAuto[], checkinPorAtleta: Map<string, string>) {
  for (const luta of todas) {
    if (luta.status_luta !== 'concluida' || luta.metodo_vitoria !== 'wo') continue;
    // Decisões da recepção/chamador são definitivas, não avanços prematuros da geração.
    if (luta.pontuacao_atleta_1?.recepcao_wo || luta.pontuacao_atleta_2?.recepcao_wo) continue;
    const a1Real = isChaveAtletaReal(luta.atleta_1);
    const a2Real = isChaveAtletaReal(luta.atleta_2);
    const byeEstrutural = (a1Real && isChaveBye(luta.atleta_2)) || (a2Real && isChaveBye(luta.atleta_1));
    if (!byeEstrutural) continue;
    const vencedorId = Number(luta.vencedor_id || (a1Real ? luta.atleta_1_id : luta.atleta_2_id) || 0);
    if (String(checkinPorAtleta.get(`${luta.categoria_id}:${vencedorId}`) || '').startsWith('desclassificado_')) continue;
    if (vencedorId && checkinPorAtleta.get(`${luta.categoria_id}:${vencedorId}`) === 'aprovado') continue;

    await supabase.from('chaves').update({
      status_luta: 'agendada',
      vencedor: null,
      vencedor_id: null,
      metodo_vitoria: null,
      finalizada_em: null,
    }).eq('id', luta.id);

    const proxima = lutaDestino(todas, luta);
    if (!proxima || statusConcluido(proxima)) continue;
    const lado = ladoDoDestino(luta);
    const nomeNoDestino = lado === 'atleta_1' ? proxima.atleta_1 : proxima.atleta_2;
    if (normalizarChaveNome(nomeNoDestino) !== normalizarChaveNome(luta.vencedor)) continue;
    const limpar = lado === 'atleta_1'
      ? { atleta_1: 'TBD', equipe_1: '', atleta_1_id: null }
      : { atleta_2: 'TBD', equipe_2: '', atleta_2_id: null };
    await supabase.from('chaves').update(limpar).eq('id', proxima.id);
  }
}

async function alinharTatameDaCategoria(supabase: SupabaseLike, todas: ChaveLutaAuto[]) {
  const referencia = new Map<string, string>();
  for (const luta of todas) {
    const chave = `${luta.categoria}__${luta.faixa || ''}`;
    if (luta.tatame && !referencia.has(chave)) referencia.set(chave, luta.tatame);
  }
  for (const luta of todas) {
    const tatame = referencia.get(`${luta.categoria}__${luta.faixa || ''}`);
    if (!tatame || luta.tatame) continue;
    luta.tatame = tatame;
    const { error } = await supabase.from('chaves').update({ tatame }).eq('id', luta.id);
    if (error) throw error;
  }
}

export async function processarAvancosAutomaticosChaves(supabase: SupabaseLike, eventoId: string | number, categoriaId?: string) {
  let houveAvanco = false;
  let consulta = supabase.from('recepcao_categorias').select('categoria_id').eq('evento_id', eventoId).eq('fechada', true);
  if (categoriaId) consulta = consulta.eq('categoria_id', categoriaId);
  const { data: controles, error: controleError } = await consulta;
  if (controleError) throw controleError;
  if (!controles?.length) return false;
  const fechadas = new Set<string>(controles.map((c: { categoria_id: string }) => c.categoria_id));
  if (supabase.rpc) for (const categoria of fechadas) {
    const { error } = await supabase.rpc('recepcao_resolver_ausencias', { p_categoria: categoria });
    if (error) throw error;
  }

  for (let rodada = 0; rodada < 20; rodada++) {
    if (rodada > 0 && supabase.rpc) for (const categoria of fechadas) {
      const { error } = await supabase.rpc('recepcao_resolver_ausencias', { p_categoria: categoria });
      if (error) throw error;
    }
    const { data, error } = await supabase
      .from('chaves')
      .select('*')
      .eq('evento_id', eventoId);

    if (error) throw error;
    if (!data) return houveAvanco;

    const todas = (data as ChaveLutaAuto[]).filter(l => l.categoria_id && fechadas.has(l.categoria_id));
    await alinharTatameDaCategoria(supabase, todas);
    const idsComAvanco = Array.from(new Set(todas.flatMap((luta) => [luta.atleta_1_id, luta.atleta_2_id]).filter(Boolean))) as number[];
    const { data: inscricoes, error: inscricoesError } = idsComAvanco.length > 0
      ? await supabase.from('inscricoes').select('atleta_id,categoria_id,status_checkin').eq('evento_id', eventoId).in('atleta_id', idsComAvanco)
      : { data: [] as Array<{ atleta_id: number; categoria_id: string; status_checkin: string }>, error: null };
    if (inscricoesError) throw inscricoesError;
    const checkinPorAtleta = new Map<string, string>((inscricoes || []).map((item: { atleta_id: number; categoria_id: string; status_checkin: string }) => [`${item.categoria_id}:${item.atleta_id}`, String(item.status_checkin || 'pendente')]));
    if (rodada === 0) {
      await reabrirWoSemChecagem(supabase, todas, checkinPorAtleta);
      continue;
    }
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
        if (isChaveBye(luta.atleta_2) && !sozinhoNaChave(todas, luta) && !luta.proxima_luta) continue;
        if (ehFaseChaveDeTres(luta.fase) && isChaveBye(luta.atleta_2) && !sozinhoNaChave(todas, luta)) continue;
        if (!luta.atleta_1_id || checkinPorAtleta.get(`${luta.categoria_id}:${luta.atleta_1_id}`) !== 'aprovado') continue;
        if (!await concluirWo(supabase, todas, luta, 'atleta_1')) continue;
        processouNestaRodada = true;
        houveAvanco = true;
        continue;
      }

      if (atleta2Real && atleta1Fantasma) {
        if (isChaveTbd(luta.atleta_1) && temAlimentadoraPendente) continue;
        if (isChaveBye(luta.atleta_1) && !sozinhoNaChave(todas, luta) && !luta.proxima_luta) continue;
        if (ehFaseChaveDeTres(luta.fase) && isChaveBye(luta.atleta_1) && !sozinhoNaChave(todas, luta)) continue;
        if (!luta.atleta_2_id || checkinPorAtleta.get(`${luta.categoria_id}:${luta.atleta_2_id}`) !== 'aprovado') continue;
        if (!await concluirWo(supabase, todas, luta, 'atleta_2')) continue;
        processouNestaRodada = true;
        houveAvanco = true;
        continue;
      }

      if (atleta1Fantasma && atleta2Fantasma) {
        if (temAlimentadoraPendente) continue;
        // Um resultado já gravado pode ainda estar propagando o vencedor.
        // TBD nunca comprova que uma vaga da próxima fase é vazia.
        if (alimentadoras.length && (isChaveTbd(luta.atleta_1) || isChaveTbd(luta.atleta_2))) continue;
        if (!await concluirWo(supabase, todas, luta, 'bye')) continue;
        processouNestaRodada = true;
        houveAvanco = true;
      }
    }

    if (!processouNestaRodada) break;
  }

  return houveAvanco;
}
