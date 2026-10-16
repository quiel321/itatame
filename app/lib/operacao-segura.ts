import { processarAvisosPendentes } from './avisos-operacao-cliente';
import { supabase } from './supabase';
import { garantirVinculoStaff, lerSessaoStaff } from './staff-sessao';
import { enviarOperacao, prepararOperacao, type ContextoOperacao, type PedidoOperacao, type TipoOperacao } from './operacao-persistente';
export function contextoOperacao(): ContextoOperacao {
  const sessao = lerSessaoStaff();
  if (!sessao?.id || !sessao.evento_id) throw new Error('Entre novamente com o PIN do posto antes de operar.');
  return { evento: String(sessao.evento_id), posto: String(sessao.id) };
}
async function enviar(p: PedidoOperacao) {
  const contexto = contextoOperacao();
  if (contexto.evento !== p.evento || contexto.posto !== p.posto) throw new Error('Esta pendência pertence a outro posto ou campeonato.');
  const vinculo = await garantirVinculoStaff();
  if (!vinculo.ok) throw new Error(vinculo.erro);
  const { data, error } = await supabase.rpc('operacao_executar', {
    p_id: p.id, p_evento: p.evento, p_tipo: p.tipo, p_alvo: p.alvo, p_dados: p.dados, p_base: p.base,
  });
  if (error) throw new Error(error.message);
  return data;
}
export async function recuperarOperacao(p: PedidoOperacao) {
  const resposta = await enviarOperacao(localStorage, p, enviar);
  window.dispatchEvent(new CustomEvent('itatame:operacao-confirmada', { detail: { pedido: p, resposta } }));
  return resposta;
}
export async function executarOperacao(tipo: TipoOperacao, alvo: string | number, dados: Record<string, unknown>, base: Record<string, unknown> = {}) {
  const p = prepararOperacao(localStorage, contextoOperacao(), tipo, String(alvo), dados, base);
  window.dispatchEvent(new Event('itatame:pendencias-alteradas'));
  try { return await recuperarOperacao(p); }
  finally { window.dispatchEvent(new Event('itatame:pendencias-alteradas')); }
}
export function baseLuta(l: any) { return { atleta_1_id: l.atleta_1_id ?? null, atleta_2_id: l.atleta_2_id ?? null }; }
export function baseRelogio(l: any) { return { ...baseLuta(l), status_luta: l.status_luta, iniciada_em: l.iniciada_em ?? null, duracao_segundos: l.duracao_segundos ?? null }; }

// Notificação é auxiliar. A confirmação da pesagem/chamada não depende dela.
export function notificarSemBloquear(_body: unknown) {
  // O recibo já guardou o aviso no banco. A resposta perdida não cria uma nova mensagem.
  void processarAvisosPendentes(undefined,true).catch(()=>{});
}
