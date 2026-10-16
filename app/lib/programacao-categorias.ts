import { obterTempoRegulamentar } from './cronograma';
import { ehFinalProgramacao, ladosParaDescanso } from './descanso-programacao';

export type LutaProgramacao = {
  id: string | number; categoria: string; categoria_id?: string | null; faixa?: string | null;
  tatame?: string | null; ordem_tatame?: number | null; horario_estimado?: string | null;
  tempo_minutos?: number | null; atleta_1?: string | null; atleta_2?: string | null;
  status_luta?: string | null; vencedor?: string | null; iniciada_em?: string | null;
  fase?: string | null; id_visual?: string | number | null; proxima_luta?: string | number | null;
  atleta_1_id?: number | null; atleta_2_id?: number | null;
};
export type OpcoesProgramacao = { reservarDescanso?: boolean; margemCategorias?: number; reservaFinal?: number };
export type InicioCategoria = { categoria_id: string; inicio_previsto: string | null };
const instante = (v?: string | null) => v ? Date.parse(v) : NaN;
const chave = (l: LutaProgramacao) => l.categoria_id || `${l.categoria}__${l.faixa || ''}`;
export const lutaPendenteProgramacao = (l: LutaProgramacao) => !l.vencedor && !['concluida', 'cancelada'].includes(l.status_luta || '')
  && ![l.atleta_1, l.atleta_2].some(n => String(n || '').trim().toUpperCase() === 'BYE');

/** Calcula previsões sem antecipar categorias nem reordenar/gerar confrontos. */
export function planejarHorariosCategorias(lutas: LutaProgramacao[], inicioTatame: string, intervalo: number, inicios: InicioCategoria[], opcoes: OpcoesProgramacao = {}) {
  let ponteiro = instante(inicioTatame);
  if (!Number.isFinite(ponteiro)) throw new Error('Informe o início do tatame.');
  if (!Number.isInteger(intervalo) || intervalo < 0 || intervalo > 10) throw new Error('O intervalo deve ser de 0 a 10 minutos.');
  const margem = opcoes.margemCategorias ?? 0, reserva = opcoes.reservaFinal ?? 0;
  if (![margem, reserva].every(m => Number.isInteger(m) && m >= 0 && m <= 60)) throw new Error('As margens devem ser de 0 a 60 minutos.');
  const horarios = new Map(inicios.map(c => [c.categoria_id, c.inicio_previsto]));
  for (const c of inicios) if (c.inicio_previsto && !Number.isFinite(instante(c.inicio_previsto))) throw new Error('Horário de categoria inválido.');
  const lados = opcoes.reservarDescanso ? ladosParaDescanso(lutas) : null;
  const fila = lutas.filter(luta => {
    if (!lutaPendenteProgramacao(luta)) return false;
    const par = lados?.get(luta.id);
    // Avanços estruturais não ocupam tatame. Sem origens nem dependências, mantém o caso legado.
    const temOrigens = lutas.some(p => p.categoria === luta.categoria && p.faixa === luta.faixa && p.proxima_luta != null && String(p.proxima_luta) === String(luta.id_visual));
    return !par || (!par[0].size && !par[1].size && !temOrigens) || Boolean(par[0].size && par[1].size);
  }).sort((a, b) => (a.ordem_tatame ?? Infinity) - (b.ordem_tatame ?? Infinity));
  if (fila.some(l => !l.tatame?.trim() || !Number.isInteger(l.ordem_tatame) || l.ordem_tatame! < 1)) throw new Error('Salve a sequência e os tatames antes dos horários.');
  if (new Set(fila.map(l => l.tatame!.trim().toUpperCase())).size > 1) throw new Error('Calcule um tatame por vez.');
  if (new Set(fila.map(l => l.ordem_tatame)).size !== fila.length) throw new Error('Existem posições repetidas na fila.');
  const vistos = new Set<string>();
  let anterior = '';
  const avisos: { categoria: string; previsto: string; estimado: string; atrasoMinutos: number }[] = [];
  const categorias: { categoria: string; inicio: string; fim: string; lutas: number; descansoMinutos: number }[] = [];
  const origens = new Map([...(lados || [])].map(([id, par]) => [id, new Set([...par[0], ...par[1]])]));
  const ultimoCombate = new Map<string, number>(), ultimoDoGrupo = new Map<string, number>();
  const updates = fila.map(luta => {
    const grupo = chave(luta);
    const minutos = luta.tempo_minutos ?? obterTempoRegulamentar(luta.categoria, luta.faixa || '');
    if (!Number.isFinite(minutos) || minutos <= 0) throw new Error('Duração de luta inválida. Confira a categoria.');
    if (grupo !== anterior) {
      if (vistos.has(grupo)) throw new Error('Mantenha as lutas de cada categoria juntas na sequência.');
      vistos.add(grupo); anterior = grupo;
      const ultima = categorias[categorias.length - 1];
      if (ultima) ponteiro = Math.max(ponteiro, instante(ultima.fim) + margem * 60000);
      const solicitado = horarios.get(luta.categoria_id || '');
      if (solicitado) {
        const previsto = instante(solicitado);
        // O horário anunciado é preservado na categoria; a fila nunca sobrepõe lutas.
        ponteiro = Math.max(ponteiro, previsto);
      }
      categorias.push({ categoria: luta.categoria, inicio: new Date(ponteiro).toISOString(), fim: '', lutas: 0, descansoMinutos: 0 });
    }
    const grupoAtual = categorias[categorias.length - 1];
    if (opcoes.reservarDescanso) {
      const candidatos = origens.get(luta.id) || new Set<string>();
      const antes = ponteiro, descanso = minutos * (ehFinalProgramacao(luta) ? 2 : 1) * 60000;
      for (const atleta of candidatos) if (ultimoCombate.has(atleta)) ponteiro = Math.max(ponteiro, ultimoCombate.get(atleta)! + descanso);
      // Chave legada sem origem identificável: assume repetição de atleta.
      if (!candidatos.size && ultimoDoGrupo.has(grupo)) ponteiro = Math.max(ponteiro, ultimoDoGrupo.get(grupo)! + descanso);
      grupoAtual.descansoMinutos += (ponteiro - antes) / 60000;
      const fim = ponteiro + minutos * 60000;
      for (const atleta of candidatos) ultimoCombate.set(atleta, fim);
      ultimoDoGrupo.set(grupo, fim);
    }
    const horario_estimado = new Date(ponteiro).toISOString();
    if (!grupoAtual.lutas) {
      grupoAtual.inicio = horario_estimado;
      const solicitado = horarios.get(luta.categoria_id || '');
      if (solicitado && ponteiro > instante(solicitado)) avisos.push({ categoria: luta.categoria, previsto: solicitado, estimado: horario_estimado, atrasoMinutos: Math.ceil((ponteiro - instante(solicitado)) / 60000) });
    }
    grupoAtual.lutas++; grupoAtual.fim = new Date(ponteiro + minutos * 60000).toISOString();
    ponteiro += (minutos + intervalo) * 60000;
    return { id: luta.id, tatame: luta.tatame, ordem_tatame: luta.ordem_tatame, horario_estimado,
      tatame_anterior: luta.tatame ?? null, ordem_anterior: luta.ordem_tatame ?? null, horario_anterior: luta.horario_estimado ?? null };
  });
  const fim = categorias.at(-1)?.fim || null;
  return { updates, avisos, categorias, fim, fimComMargem: fim ? new Date(instante(fim) + reserva * 60000).toISOString() : null };
}

export type CategoriaProgramada = { id: string; nome: string; inicio_lutas_previsto?: string | null };
export function resumirProgramacao(lutas: LutaProgramacao[], categorias: CategoriaProgramada[], agora = new Date()) {
  const metas = new Map(categorias.map(c => [c.id, c]));
  const grupos = new Map<string, { categoriaId: string; nome: string; tatame: string; ordem: number; lutas: LutaProgramacao[] }>();
  for (const l of lutas) {
    if (!l.tatame?.trim() || !l.categoria_id || !l.ordem_tatame) continue;
    const k = `${l.tatame.trim().toUpperCase()}:${l.categoria_id}`;
    const g = grupos.get(k) || { categoriaId: l.categoria_id, nome: metas.get(l.categoria_id)?.nome || l.categoria, tatame: l.tatame.trim(), ordem: Infinity, lutas: [] };
    g.ordem = Math.min(g.ordem, l.ordem_tatame); g.lutas.push(l); grupos.set(k, g);
  }
  return [...grupos.values()].map(g => {
    const pendentes = g.lutas.filter(lutaPendenteProgramacao);
    const horasOriginais = g.lutas.map(l => instante(l.horario_estimado)).filter(Number.isFinite);
    const previsto = metas.get(g.categoriaId)?.inicio_lutas_previsto || (horasOriginais.length ? new Date(Math.min(...horasOriginais)).toISOString() : null);
    const horas = pendentes.map(l => instante(l.horario_estimado)).filter(Number.isFinite);
    const estimado = horas.length ? new Date(Math.min(...horas)).toISOString() : null;
    const real = (n?: string | null) => Boolean(n && !['BYE', 'TBD'].includes(n.trim().toUpperCase()));
    const emOperacao = g.lutas.some(l => real(l.atleta_1) && real(l.atleta_2) && (l.iniciada_em || l.status_luta === 'em_andamento' || l.vencedor));
    return { ...g, pendentes: pendentes.length, previsto, estimado, emOperacao,
      concluida: pendentes.length === 0,
      horarioUltrapassado: !emOperacao && pendentes.length > 0 && Number.isFinite(instante(previsto || estimado)) && instante(previsto || estimado) < agora.getTime() };
  }).sort((a, b) => a.tatame.localeCompare(b.tatame, 'pt-BR', { numeric: true }) || a.ordem - b.ordem);
}
