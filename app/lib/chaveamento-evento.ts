import { montarChaves, prepararGrupos } from '@/app/lib/gerar-chaves';
import type { CategoriaCompeticao, InscricaoCompeticao } from '@/app/lib/categorias-competicao';

type ClienteSupabase = {
  from: (tabela: string) => any;
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { code?: string; message: string } | null }>;
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
    db.from('chaves').select('id,categoria,status_luta,vencedor,iniciada_em').eq('evento_id', eventoId),
  ]);
  if (inscritos.error || existentes.error) throw new Error('Não foi possível conferir as inscrições e chaves. Tente novamente.');
  if (categorias.error) throw new Error('A atualização do banco de competição ainda não foi instalada. As chaves foram preservadas.');
  if ((existentes.data || []).some((luta: { vencedor?: string | null; iniciada_em?: string | null; status_luta?: string | null }) => luta.vencedor || luta.iniciada_em || ['concluida', 'em_andamento'].includes(luta.status_luta || ''))) {
    throw new Error('Já existem lutas iniciadas ou resultados neste evento. As chaves foram preservadas.');
  }
  const preparados = prepararGrupos((inscritos.data || []) as InscricaoCompeticao[], tipo, (categorias.data || []) as CategoriaCompeticao[]);
  const grupos = Object.entries(preparados.grupos).map(([categoria, atletas]) => {
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
    lutas: montarChaves(eventoId, preparados),
    existentes: existentes.data || [],
    inscritos: inscritos.data || [],
    categorias: categorias.data || [],
  };
}

export async function gravarChavesEvento(
  db: ClienteSupabase,
  evento: EventoChaveamento,
  tipo: 'peso' | 'absoluto',
  lutas: unknown[],
) {
  const { data: total, error } = await db.rpc('substituir_chaves_evento', {
    p_evento: evento.id,
    p_tipo: tipo,
    p_lutas: lutas,
    p_organizador: evento.organizador_id,
  });
  if (error) throw new Error(error.code === 'PGRST202' ? 'Instale a atualização do banco antes de gerar chaves.' : error.message);
  return Number(total) || lutas.length;
}

export async function gerarChavesAutomaticasEvento(db: ClienteSupabase, evento: EventoChaveamento) {
  const gerados: { tipo: 'peso' | 'absoluto'; total: number }[] = [];
  for (const tipo of ['peso', 'absoluto'] as const) {
    try {
      const preparado = await prepararChavesEvento(db, evento.id, tipo, false);
      const jaExiste = (preparado.existentes as { categoria?: string | null }[]).some(luta => tipo === 'absoluto' ? lutaEhAbsoluto(luta) : !lutaEhAbsoluto(luta));
      if (jaExiste) continue;
      const total = await gravarChavesEvento(db, evento, tipo, preparado.lutas);
      gerados.push({ tipo, total });
    } catch (error) {
      if (tipo === 'absoluto' && error instanceof Error && error.message.includes('Nenhuma inscrição apta')) continue;
      throw error;
    }
  }
  return gerados;
}
