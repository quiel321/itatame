import crypto from 'node:crypto';
import { MAX_ITENS_COMBO_IA, percentualComboIa, type ComboIaAssinado, type OfertaComboIa } from './fotos-combo-ia';
import type { SupabaseClient } from '@supabase/supabase-js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function assinatura(payload: string) {
  const segredo = process.env.FOTOS_ACESSO_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!segredo) throw new Error('O pacote de IA está indisponível no momento.');
  return crypto.createHmac('sha256', segredo).update('retratt-combo-ia-v1:' + payload).digest('base64url');
}
export function assinarComboIa(combo: ComboIaAssinado) {
  const payload = Buffer.from(JSON.stringify(combo)).toString('base64url');
  return payload + '.' + assinatura(payload);
}
export function conferirAssinaturasComboIa(tokens: unknown): ComboIaAssinado[] {
  if (tokens === undefined || (Array.isArray(tokens) && tokens.length === 0)) return [];
  if (!Array.isArray(tokens) || tokens.length > 10) throw new Error('Pacote de IA inválido. Refaça a busca.');
  return tokens.map(token => {
    if (typeof token !== 'string' || token.length > 40000) throw new Error('Pacote de IA inválido.');
    const partes = token.split('.');
    if (partes.length !== 2) throw new Error('Pacote de IA inválido.');
    const esperada = Buffer.from(assinatura(partes[0])), recebida = Buffer.from(partes[1]);
    if (esperada.length !== recebida.length || !crypto.timingSafeEqual(esperada, recebida)) throw new Error('Pacote de IA inválido. Refaça a busca.');
    let combo: ComboIaAssinado;
    try { combo = JSON.parse(Buffer.from(partes[0], 'base64url').toString()); } catch { throw new Error('Pacote de IA inválido.'); }
    if (combo.versao !== 1 || !UUID.test(combo.eventoId) || !Array.isArray(combo.fotoIds) || !combo.fotoIds.length || combo.fotoIds.length > MAX_ITENS_COMBO_IA
      || combo.fotoIds.some(id => typeof id !== 'string' || !UUID.test(id)) || new Set(combo.fotoIds).size !== combo.fotoIds.length
      || !Number.isSafeInteger(combo.expira) || combo.expira < Date.now() / 1000 || combo.percentual !== percentualComboIa(combo.fotoIds.length) || !combo.percentual) {
      throw new Error('O pacote de IA expirou ou está inválido. Refaça a busca para atualizar a oferta.');
    }
    return combo;
  });
}

type Resultado = { id: string; eventoId: string; fotografoId: string | null; mimeType: string | null; precoCentavos: number; evento: { id: string; nome: string; combo_ia_ativo?: boolean; permite_download_gratis: boolean } | null };
export async function criarOfertasComboIa(db: SupabaseClient, resultados: Resultado[]): Promise<OfertaComboIa[]> {
  const elegiveis = resultados.filter(r => r.evento?.combo_ia_ativo && !r.evento.permite_download_gratis && !r.mimeType?.startsWith('video/') && r.precoCentavos > 0);
  if (!elegiveis.length) return [];
  const eventos = [...new Set(elegiveis.map(r => r.eventoId))];
  const { data: vinculos, error } = await db.from('foto_evento_fotografos').select('evento_id,fotografo_id,status,modelo_recebimento').in('evento_id', eventos).eq('status', 'ativo');
  if (error) throw new Error('Não foi possível conferir o pacote de fotos. Tente novamente.');
  const grupos = new Map<string, Resultado[]>();
  for (const r of elegiveis) {
    const autores = [...new Set(elegiveis.filter(i => i.eventoId === r.eventoId).map(i => i.fotografoId))];
    const conjunta = autores.every(id => vinculos?.some(v => v.evento_id === r.eventoId && v.fotografo_id === id && v.modelo_recebimento === 'diaria_organizador'));
    const chave = `${r.eventoId}:${conjunta ? 'conjunta' : r.fotografoId}`;
    grupos.set(chave, [...(grupos.get(chave) || []), r]);
  }
  const expira = Math.floor(Date.now() / 1000) + 24 * 3600;
  return [...grupos.values()].flatMap(grupo => {
    const fotoIds = [...new Set(grupo.map(r => r.id))].sort(), percentual = percentualComboIa(fotoIds.length);
    if (!percentual) return [];
    const subtotalCentavos = grupo.reduce((s, r) => s + r.precoCentavos, 0), descontoCentavos = Math.round(subtotalCentavos * percentual / 100);
    const combo: ComboIaAssinado = { versao: 1, eventoId: grupo[0].eventoId, fotoIds, percentual, expira };
    return [{ ...combo, eventoNome: grupo[0].evento!.nome, quantidade: fotoIds.length, subtotalCentavos, descontoCentavos, totalCentavos: subtotalCentavos - descontoCentavos, token: assinarComboIa(combo) }];
  });
}

export function validarComboIaNoCheckout(combos: ComboIaAssinado[], itens: { id: string; evento_id: string; mime_type?: string | null }[], evento: { id: string; combo_ia_ativo?: boolean }) {
  for (const c of combos) {
    if (c.eventoId !== evento.id || evento.combo_ia_ativo !== true || !c.fotoIds.every(id => itens.some(i => i.id === id && i.evento_id === c.eventoId && !i.mime_type?.startsWith('video/')))) {
      throw new Error('O pacote completo de IA não está mais disponível. Refaça a busca ou remova o pacote do carrinho.');
    }
  }
}
