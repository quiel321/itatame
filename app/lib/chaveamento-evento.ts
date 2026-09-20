import { montarChaves, prepararGrupos } from '@/app/lib/gerar-chaves';
import { processarAvancosAutomaticosChaves } from '@/app/lib/chaves-auto-avanco';
import type { CategoriaCompeticao, InscricaoCompeticao } from '@/app/lib/categorias-competicao';
import { ehFaseChaveDeTres } from '@/app/lib/chave-de-tres';

type ClienteSupabase = {
  from: (tabela: string) => any;
  rpc: (fn: string, args: Record<string, unknown>) => any;
};

export type EventoChaveamento = {
  id: string;
  organizador_id: string;
  data_fim_inscricoes?: string | null;
  lote1_data_fim?: string | null;
  lote2_data_fim?: string | null;
  lote3_data_fim?: string | null;
  data_fim_checagem?: string | null;
  data_divulgacao_chaves?: string | null;
};

export function fimInscricoesEvento(evento: EventoChaveamento) {
  const fim = evento.data_fim_inscricoes || evento.lote3_data_fim || evento.lote2_data_fim || evento.lote1_data_fim;
  const data = fim ? new Date(fim) : null;
  return data && Number.isFinite(data.getTime()) ? data : null;
}

export function chaveamentoAutomaticoLiberado(evento: EventoChaveamento, agora = new Date()) {
  const fimInscricoes = fimInscricoesEvento(evento);
  const fimChecagem = evento.data_fim_checagem ? new Date(evento.data_fim_checagem) : null;
  const divulgacao = evento.data_divulgacao_chaves ? new Date(evento.data_divulgacao_chaves) : null;
  if (!fimInscricoes || !fimChecagem || !divulgacao) return false;
  if (![fimChecagem, divulgacao].every(data => Number.isFinite(data.getTime()))) return false;
  return agora >= fimInscricoes && agora >= fimChecagem && agora >= divulgacao;
}

export function lutaEhAbsoluto(luta: { categoria?: string | null }) {
  return String(luta.categoria || '').toLowerCase().includes('absoluto');
}

export function lutaChaveTravada(luta: { vencedor?: string | null; iniciada_em?: string | null; status_luta?: string | null }) {
  return Boolean(luta.vencedor || luta.iniciada_em || ['concluida', 'em_andamento'].includes(luta.status_luta || ''));
}

export function chavesDoTipo<T extends { categoria?: string | null }>(lutas: T[], tipo: 'peso' | 'absoluto') {
  return lutas.filter((luta) => tipo === 'absoluto' ? lutaEhAbsoluto(luta) : !lutaEhAbsoluto(luta));
}

function linhaInsertChave(luta: Record<string, unknown>) {
  return {
    evento_id: luta.evento_id,
    categoria: luta.categoria,
    faixa: luta.faixa,
    categoria_id: luta.categoria_id ?? null,
    tempo_minutos: luta.tempo_minutos ?? null,
    id_visual: luta.id_visual ?? null,
    atleta_1: luta.atleta_1 ?? null,
    equipe_1: luta.equipe_1 ?? null,
    numero_1: luta.numero_1 ?? null,
    atleta_1_id: luta.atleta_1_id ?? null,
    atleta_2: luta.atleta_2 ?? null,
    equipe_2: luta.equipe_2 ?? null,
    numero_2: luta.numero_2 ?? null,
    atleta_2_id: luta.atleta_2_id ?? null,
    fase: luta.fase ?? null,
    ordem: luta.ordem ?? null,
    lado: luta.lado ?? null,
    proxima_luta: luta.proxima_luta ?? null,
    status_luta: 'agendada',
    pontuacao_atleta_1: luta.pontuacao_atleta_1 || { pontos: 0, vantagens: 0, punicoes: 0 },
    pontuacao_atleta_2: luta.pontuacao_atleta_2 || { pontos: 0, vantagens: 0, punicoes: 0 },
  };
}

type LutaExistente = {
  categoria?: string | null;
  faixa?: string | null;
  fase?: string | null;
  id_visual?: string | number | null;
};

export function precisaAtualizarChaveTriangular(
  preparados: ReturnType<typeof prepararGrupos>,
  existentes: LutaExistente[],
) {
  for (const [chave, atletas] of Object.entries(preparados.grupos)) {
    const n = atletas.length;
    if (n !== 3 && n !== 6) continue;
    const meta = preparados.metadados[chave];
    const lutas = existentes.filter(luta => luta.categoria === meta.categoria && luta.faixa === meta.faixa);
    if (!lutas.length) continue;
    const ids = new Set(lutas.map(luta => String(luta.id_visual)));
    const triangular = lutas.some(luta => ehFaseChaveDeTres(luta.fase));
    if (n === 3 && !triangular) return true;
    if (n === 6 && !(ids.has('101') && ids.has('102') && triangular)) return true;
  }
  return false;
}

async function enriquecerAcademiaInscricoes(db: ClienteSupabase, inscricoes: InscricaoCompeticao[]) {
  const atletaIds = [...new Set(inscricoes.map(item => item.atleta_id).filter((id): id is number => Number.isFinite(Number(id))))];
  const userIds = [...new Set(inscricoes.map(item => item.user_id).filter((id): id is string => Boolean(id)))];
  const equipeIds = [...new Set(inscricoes.map(item => item.equipe_id).filter((id): id is string => Boolean(id)))];
  const [atletasPorId, atletasPorUser, equipes] = await Promise.all([
    atletaIds.length
      ? db.from('atletas_publico').select('id, user_id, academia, equipe').in('id', atletaIds)
      : { data: [] as Array<{ id: number; user_id?: string; academia?: string | null; equipe?: string | null }> },
    userIds.length
      ? db.from('atletas_publico').select('id, user_id, academia, equipe').in('user_id', userIds)
      : { data: [] as Array<{ id: number; user_id?: string; academia?: string | null; equipe?: string | null }> },
    equipeIds.length
      ? db.from('equipes_evento').select('id, academia').in('id', equipeIds)
      : { data: [] as Array<{ id: string; academia?: string | null }> },
  ]);
  const academiaPorAtletaId = new Map<number, string>();
  const academiaPorUser = new Map<string, string>();
  for (const atleta of [...(atletasPorId.data || []), ...(atletasPorUser.data || [])]) {
    if (atleta.academia && atleta.id) academiaPorAtletaId.set(Number(atleta.id), String(atleta.academia));
    if (atleta.academia && atleta.user_id) academiaPorUser.set(String(atleta.user_id), String(atleta.academia));
  }
  const academiaPorEquipe = new Map((equipes.data || []).map((equipe: { id: string; academia?: string | null }) => [equipe.id, equipe.academia || '']));
  return inscricoes.map((inscricao): InscricaoCompeticao => ({
    ...inscricao,
    academia: String(
      inscricao.academia
      || (inscricao.atleta_id ? academiaPorAtletaId.get(Number(inscricao.atleta_id)) : '')
      || (inscricao.user_id ? academiaPorUser.get(String(inscricao.user_id)) : '')
      || (inscricao.equipe_id ? academiaPorEquipe.get(String(inscricao.equipe_id)) : '')
      || '',
    ).trim() || null,
  }));
}

export async function prepararChavesEvento(
  db: ClienteSupabase,
  eventoId: string,
  tipo: 'peso' | 'absoluto',
  ignorarPagamento = false,
) {
  let query = db.from('inscricoes').select('*').eq('evento_id', eventoId).order('id');
  if (!ignorarPagamento) query = query.eq('pagamento_ok', true);
  const [inscritos, categorias, existentes] = await Promise.all([
    query,
    db.from('categorias_evento').select('*').eq('evento_id', eventoId),
    db.from('chaves').select('id,categoria,faixa,id_visual,fase,status_luta,vencedor,iniciada_em').eq('evento_id', eventoId),
  ]);
  if (inscritos.error || existentes.error) throw new Error('Não foi possível conferir as inscrições e chaves. Tente novamente.');
  if (categorias.error) throw new Error('A atualização do banco de competição ainda não foi instalada. As chaves foram preservadas.');
  if (chavesDoTipo(existentes.data || [], tipo).some(lutaChaveTravada)) {
    throw new Error('Já existem lutas iniciadas ou resultados neste tipo de chave. O chaveamento foi preservado.');
  }
  const inscricoesComAcademia = await enriquecerAcademiaInscricoes(db, (inscritos.data || []) as InscricaoCompeticao[]);
  const gruposPreparados = prepararGrupos(inscricoesComAcademia, tipo, (categorias.data || []) as CategoriaCompeticao[]);
  const grupos = Object.entries(gruposPreparados.grupos).map(([categoria, atletas]) => {
    const equipes = new Map<string, { nome: string; total: number }>();
    atletas.forEach((atleta) => {
      const atual = equipes.get(atleta.equipe_chave) || { nome: atleta.equipe_atleta, total: 0 };
      atual.total += 1;
      equipes.set(atleta.equipe_chave, atual);
    });
    return {
      categoria: categoria.replace('__', ' · '),
      atletas: atletas.length,
      equipesAcimaDoLimite: Array.from(equipes.values()).filter((equipe) => equipe.total > 2),
    };
  });
  if (!grupos.length) throw new Error('Nenhuma inscrição apta para este tipo de chave.');
  return {
    grupos,
    lutas: montarChaves(eventoId, gruposPreparados),
    existentes: existentes.data || [],
    inscritos: inscricoesComAcademia,
    categorias: categorias.data || [],
    precisaAtualizarTriangular: precisaAtualizarChaveTriangular(gruposPreparados, existentes.data || []),
  };
}

export async function gravarChavesEvento(
  db: ClienteSupabase,
  evento: EventoChaveamento,
  tipo: 'peso' | 'absoluto',
  lutas: unknown[],
) {
  const { data: atuais, error: leitura } = await db
    .from('chaves')
    .select('id,categoria,status_luta,vencedor,iniciada_em')
    .eq('evento_id', evento.id);
  if (leitura) throw new Error('Não foi possível conferir as chaves atuais. Nada foi apagado.');
  const alvo = chavesDoTipo(atuais || [], tipo);
  if (alvo.some(lutaChaveTravada)) {
    throw new Error('Já existem lutas iniciadas ou resultados neste tipo de chave. O chaveamento foi preservado.');
  }

  const ids = alvo.map((luta: { id?: string }) => luta.id).filter(Boolean);
  for (let i = 0; i < ids.length; i += 80) {
    const fatia = ids.slice(i, i + 80);
    const { error } = await db.from('chaves').delete().eq('evento_id', evento.id).in('id', fatia);
    if (error) throw new Error('Não foi possível substituir só este tipo de chave. O outro chaveamento foi preservado.');
  }

  const linhas = (lutas as Record<string, unknown>[]).map(linhaInsertChave);
  if (!linhas.length) throw new Error('Chaveamento vazio. Nada foi gravado.');
  const { error: insertError } = await db.from('chaves').insert(linhas);
  if (insertError) throw new Error(insertError.message || 'Não foi possível gravar as novas chaves.');
  await processarAvancosAutomaticosChaves(db, evento.id);
  return linhas.length;
}

export async function gerarChavesAutomaticasEvento(db: ClienteSupabase, evento: EventoChaveamento) {
  const gerados: { tipo: 'peso' | 'absoluto'; total: number }[] = [];
  for (const tipo of ['peso', 'absoluto'] as const) {
    try {
      const preparado = await prepararChavesEvento(db, evento.id, tipo, false);
      const jaExiste = chavesDoTipo(preparado.existentes as { categoria?: string | null }[], tipo).length > 0;
      if (jaExiste && !preparado.precisaAtualizarTriangular) continue;
      const total = await gravarChavesEvento(db, evento, tipo, preparado.lutas);
      gerados.push({ tipo, total });
    } catch (error) {
      if (error instanceof Error && (error.message.includes('Já existem lutas iniciadas') || error.message.includes('Nenhuma inscrição apta') || error.message.includes('O outro chaveamento foi preservado'))) continue;
      throw error;
    }
  }
  await processarAvancosAutomaticosChaves(db, evento.id);
  return gerados;
}
