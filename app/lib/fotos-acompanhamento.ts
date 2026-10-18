import { conferirRegistroVendas, registrarVendasFotografos } from './fotos-vendas-diaria';

export type SituacaoPedidoFotos = 'pago' | 'pix_pendente' | 'cobranca_gerada' | 'checkout_iniciado' | 'cancelado' | 'reembolsado';
export const ROTULOS_PEDIDO_FOTOS: Record<SituacaoPedidoFotos, string> = {
  pago: 'Pago', pix_pendente: 'Pix aguardando pagamento', cobranca_gerada: 'Cobrança gerada',
  checkout_iniciado: 'Checkout iniciado', cancelado: 'Cancelado', reembolsado: 'Reembolsado',
};
export type ItemAcompanhamento = { id: string; foto_id: string; preco_centavos: number; download_liberado: boolean; download_expires_at: string | null; foto_arquivos: { fotografo_id: string; titulo: string | null; nome_original: string | null; mime_type: string; r2_preview_key?: string | null; fotografos: { nome: string } | null } | null };
export type PedidoAcompanhamento = {
  id: string; evento_id: string; comprador_user_id: string | null; comprador_email: string | null; comprador_nome: string | null;
  status: string; created_at: string; pago_em: string | null; provedor_payment_id: string | null; provedor_status_detail: string | null;
  total_centavos: number; subtotal_centavos: number; desconto_centavos: number; comissao_itatame_centavos: number;
  comissao_organizador_centavos: number; modelo_recebimento: string; fotografo_id: string | null; organizador_user_id: string | null;
  email_confirmacao_enviado_em: string | null; email_confirmacao_erro: string | null; vendas_fotografos: unknown;
  foto_pedido_itens: ItemAcompanhamento[];
};
export type PedidoFotosPainel = {
  id: string; criadoEm: string; pagoEm: string | null; situacao: SituacaoPedidoFotos; quantidade: number;
  comprador: { nome: string; email: string | null } | null; pagamentoId: string | null; modelo: string;
  valores: { subtotal: number; desconto: number; total: number; comissao: number; royalty: number; antesTarifa: number } | null;
  autores: { nome: string; quantidade: number; total: number; comissao: number; antesTarifa: number }[];
  itens: { id: string; fotoId: string; titulo: string; autor: string; liberado: boolean; expiraEm: string | null }[];
  email: { enviadoEm: string | null; erro: string | null } | null;
  relacionadas: { tipo: 'confirmada' | 'possivel'; pedidos: string[]; quantidade: number; restantes: number } | null;
  lembrete: { permitido: boolean; motivo: string; quantidade: number };
};

export function situacaoPedidoFotos(p: Pick<PedidoAcompanhamento, 'status' | 'provedor_payment_id' | 'provedor_status_detail'>): SituacaoPedidoFotos {
  if (p.status === 'pago' || p.status === 'cancelado' || p.status === 'reembolsado') return p.status;
  if (!p.provedor_payment_id) return 'checkout_iniciado';
  return p.provedor_status_detail === 'pending_waiting_transfer' ? 'pix_pendente' : 'cobranca_gerada';
}
const nomeNormalizado = (s: string | null) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
const emailNormalizado = (s: string | null) => (s || '').trim().toLowerCase();

// Nomes iguais não comprovam identidade. Não cancelamos nem modificamos pedidos relacionados.
export function relacionarComprasFotos(p: PedidoAcompanhamento, todos: PedidoAcompanhamento[]) {
  const ids = new Set(p.foto_pedido_itens.map(i => i.foto_id));
  const confirmados = new Set<string>(), possiveis = new Set<string>(), pedidos: string[] = [];
  for (const q of todos) {
    if (q.id === p.id || q.status !== 'pago' || q.evento_id !== p.evento_id) continue;
    const mesmo = Boolean(p.comprador_user_id && p.comprador_user_id === q.comprador_user_id)
      || Boolean(emailNormalizado(p.comprador_email) && emailNormalizado(p.comprador_email) === emailNormalizado(q.comprador_email));
    const nome = nomeNormalizado(p.comprador_nome);
    const parecido = nome.split(' ').filter(Boolean).length >= 2 && nome === nomeNormalizado(q.comprador_nome);
    if (!mesmo && !parecido) continue;
    const comuns = q.foto_pedido_itens.map(i => i.foto_id).filter(id => ids.has(id));
    if (!comuns.length) continue;
    pedidos.push(q.id);
    comuns.forEach(id => (mesmo ? confirmados : possiveis).add(id));
  }
  const uniao = new Set([...confirmados, ...possiveis]);
  return uniao.size ? { tipo: possiveis.size ? 'possivel' as const : 'confirmada' as const, pedidos,
    quantidade: uniao.size, restantes: Math.max(0, ids.size - uniao.size) } : null;
}

export function apresentarPedidoFotos(p: PedidoAcompanhamento, todos: PedidoAcompanhamento[], fotografoId: string | null, historicoCompleto: boolean): PedidoFotosPainel {
  const itens = fotografoId ? p.foto_pedido_itens.filter(i => i.foto_arquivos?.fotografo_id === fotografoId) : p.foto_pedido_itens;
  let valores: PedidoFotosPainel['valores'] = null, autores: PedidoFotosPainel['autores'] = [];
  try {
    if (p.modelo_recebimento === 'diaria_organizador') {
      const registro = p.vendas_fotografos ?? registrarVendasFotografos(p.foto_pedido_itens.map(i => ({
        fotografoId: i.foto_arquivos?.fotografo_id || p.fotografo_id || '', nome: i.foto_arquivos?.fotografos?.nome || 'Fotógrafo',
        precoCentavos: i.preco_centavos, mimeType: i.foto_arquivos?.mime_type,
      })), Number(p.desconto_centavos || 0), Number(p.comissao_itatame_centavos || 0));
      const vendas = conferirRegistroVendas(registro, Number(p.total_centavos), Number(p.comissao_itatame_centavos || 0))
        .filter(v => !fotografoId || v.fotografoId === fotografoId);
      autores = vendas.map(v => ({ nome: v.nome, quantidade: v.quantidade, total: v.totalCentavos, comissao: v.comissaoRetrattCentavos, antesTarifa: v.antesTarifaCentavos }));
      if (vendas.length) valores = vendas.reduce((s, v) => ({ subtotal: s.subtotal + v.subtotalCentavos, desconto: s.desconto + v.descontoCentavos,
        total: s.total + v.totalCentavos, comissao: s.comissao + v.comissaoRetrattCentavos, royalty: 0, antesTarifa: s.antesTarifa + v.antesTarifaCentavos }), { subtotal: 0, desconto: 0, total: 0, comissao: 0, royalty: 0, antesTarifa: 0 });
    } else if (!fotografoId || p.fotografo_id === fotografoId) {
      const total = Number(p.total_centavos), comissao = Number(p.comissao_itatame_centavos || 0), royalty = Number(p.comissao_organizador_centavos || 0);
      valores = { subtotal: Number(p.subtotal_centavos), desconto: Number(p.desconto_centavos || 0), total, comissao, royalty, antesTarifa: total - comissao - royalty };
      autores = [{ nome: itens[0]?.foto_arquivos?.fotografos?.nome || 'Fotógrafo', quantidade: itens.length, total, comissao, antesTarifa: total - comissao - royalty }];
    }
  } catch { /* Um registro financeiro incompleto não vira um valor estimado. */ }
  const situacao = situacaoPedidoFotos(p);
  const relacionadas = situacao === 'pago' ? null : relacionarComprasFotos(p, todos);
  const restantes = relacionadas?.restantes ?? itens.length;
  const motivo = fotografoId ? 'O contato com o comprador é feito pelo organizador.'
    : !historicoCompleto ? 'O histórico está limitado. Confira as compras anteriores antes de contatar o cliente.'
    : !['checkout_iniciado', 'pix_pendente', 'cobranca_gerada'].includes(situacao) ? 'Este pedido não aguarda compra.'
    : relacionadas?.tipo === 'possivel' ? 'Há uma possível compra com outro cadastro. Confira antes de contatar.'
    : !restantes ? 'Todos os arquivos deste pedido já foram comprados em outro pedido.' : '';
  return {
    id: p.id, criadoEm: p.created_at, pagoEm: p.pago_em, situacao, quantidade: itens.length,
    comprador: fotografoId ? null : { nome: p.comprador_nome || 'Comprador', email: p.comprador_email },
    pagamentoId: fotografoId ? null : p.provedor_payment_id, modelo: p.modelo_recebimento, valores, autores,
    itens: itens.map(i => ({ id: i.id, fotoId: i.foto_id, titulo: i.foto_arquivos?.titulo || i.foto_arquivos?.nome_original || 'Arquivo',
      autor: i.foto_arquivos?.fotografos?.nome || 'Fotógrafo', liberado: i.download_liberado, expiraEm: i.download_expires_at })),
    email: fotografoId ? null : { enviadoEm: p.email_confirmacao_enviado_em, erro: p.email_confirmacao_erro ? 'O envio não foi concluído.' : null },
    relacionadas: relacionadas ? { ...relacionadas } : null,
    lembrete: { permitido: !motivo && Boolean(p.comprador_email) && restantes > 0, motivo: motivo || (!p.comprador_email ? 'E-mail não cadastrado.' : ''), quantidade: restantes },
  };
}

export function prepararTextoLembreteFotos(p: PedidoFotosPainel, galeria: string, url: string) {
  if (!p.lembrete.permitido || !p.comprador?.email) throw new Error(p.lembrete.motivo || 'Lembrete indisponível.');
  const parcial = Boolean(p.relacionadas);
  return { destinatario: p.comprador.email, assunto: `Suas fotos de ${galeria} — Retratt`, texto:
    `Olá, ${p.comprador.nome}!\n\n${parcial ? `Você já comprou parte das fotos que havia selecionado. Ainda há ${p.lembrete.quantidade} arquivo(s) daquela seleção que não aparecem como comprados.` : `Você iniciou uma seleção de ${p.lembrete.quantidade} arquivo(s) em ${galeria}. Caso ainda tenha interesse, pode revisar suas fotos e concluir a compra na Retratt.`}\n\nConfira a galeria: ${url}\n\nSe você já concluiu a compra usando outro cadastro, desconsidere este lembrete.\n\nEquipe Retratt` };
}
