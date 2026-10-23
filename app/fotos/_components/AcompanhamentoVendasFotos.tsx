'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouterFotos as useRouter } from '@/app/fotos/_components/useRouterFotos';
import { ArrowUpRight, CheckCircle2, Clock3, Copy, FileText, Loader2, RefreshCw, Search, X } from 'lucide-react';
import { supabase } from '@/app/lib/supabase';
import { ROTULOS_PEDIDO_FOTOS, type PedidoFotosPainel } from '@/app/lib/fotos-acompanhamento';
import TarifasMercadoPago from '../admin/_components/TarifasMercadoPago';
import PainelOrganizador from '../admin/_components/PainelOrganizador';
import PainelFotografo from '../fotografo/_components/PainelFotografo';
import s from '../fotografo/_components/gestao.module.css';

type Perfil = 'organizador' | 'fotografo';
type Dados = { galerias: { id: string; nome: string }[]; galeriaId: string | null; pedidos: PedidoFotosPainel[]; parcial: boolean; limite?: number; atualizadoEm: string };
type Detalhe = { pedido: PedidoFotosPainel; imagens: { fotoId: string; url: string }[]; downloads: { solicitacoes: number; itensAcessados: number; ultimoEm: string | null; parcial: boolean };
  mercadoPago: { status: string; metodo: string; aprovadoEm: string | null; expiraEm: string | null; taxaCentavos: number | null; liquidoCentavos: number | null; consultadoEm: string } | null; erroMP: string | null };
type Rascunho = { destinatario: string; assunto: string; texto: string };
type Consultar = <T>(extra: Record<string, string>, signal?: AbortSignal) => Promise<T>;
const moeda = (n: number | null | undefined) => n == null ? 'Não disponível' : (n / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const quando = (s: string | null) => s ? new Date(s).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'Sem registro';
const textoNormalizado = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const botao = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-xs font-bold transition-colors hover:bg-white/10 disabled:opacity-40';

function Situacao({ pedido }: { pedido: PedidoFotosPainel }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold ${pedido.situacao === 'pago' ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300' : ['cancelado', 'reembolsado'].includes(pedido.situacao) ? 'border-zinc-700 bg-zinc-800 text-zinc-300' : 'border-orange-400/25 bg-orange-400/10 text-orange-200'}`}>{ROTULOS_PEDIDO_FOTOS[pedido.situacao]}</span>;
}

function JanelaPedido({ pedido, perfil, consultar, fechar }: { pedido: PedidoFotosPainel; perfil: Perfil; consultar: Consultar; fechar: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null);
  const [ocupado, setOcupado] = useState(true), [erro, setErro] = useState('');
  const [rascunho, setRascunho] = useState<Rascunho | null>(null), [copiado, setCopiado] = useState(false);
  const proprio = perfil === 'fotografo';
  const atual = detalhe?.pedido || pedido;
  useEffect(() => {
    dialog.current?.showModal();
    const controller = new AbortController();
    consultar<Detalhe>({ pedido: pedido.id }, controller.signal).then(setDetalhe).catch(e => { if (!controller.signal.aborted) setErro(e.message); }).finally(() => { if (!controller.signal.aborted) setOcupado(false); });
    return () => controller.abort();
  }, [pedido.id, consultar]);
  async function conferirMP() {
    setOcupado(true); setErro('');
    try { setDetalhe(await consultar<Detalhe>({ pedido: pedido.id, conferirMP: '1' })); }
    catch (e) { setErro(e instanceof Error ? e.message : 'Consulta indisponível.'); }
    finally { setOcupado(false); }
  }
  async function prepararLembrete() {
    setOcupado(true); setErro(''); setCopiado(false);
    try { const dados = await consultar<{ rascunho: Rascunho }>({ pedido: pedido.id, acao: 'lembrete' }); setRascunho(dados.rascunho); }
    catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível preparar o lembrete.'); }
    finally { setOcupado(false); }
  }
  const liberados = atual.itens.filter(i => i.liberado).length;
  return <dialog ref={dialog} aria-labelledby="titulo-pedido-fotos" onCancel={fechar} onClick={e => { if (e.target === dialog.current) { const rect = dialog.current.getBoundingClientRect(); if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) fechar(); } }} className="m-auto max-h-[90dvh] w-[calc(100%-1rem)] max-w-3xl overflow-y-auto rounded-2xl border border-white/15 bg-[#0a0a0e] p-0 text-white shadow-2xl backdrop:bg-black/80">
    <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-white/10 bg-[#0a0a0e] p-4 sm:p-6">
      <div className="min-w-0"><p className="text-[10px] text-zinc-500">Pedido #{atual.id.slice(0, 8)}</p><h2 id="titulo-pedido-fotos" className="mt-1 break-words text-lg font-black">{atual.comprador?.nome || 'Sua participação nesta venda'}</h2>{atual.comprador?.email && <p className="mt-1 break-all text-xs text-zinc-400">{atual.comprador.email}</p>}<div className="mt-3"><Situacao pedido={atual} /></div></div>
      <button type="button" onClick={fechar} aria-label="Fechar detalhes do pedido" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 hover:bg-white/10"><X size={19} /></button>
    </div>
    <div className="space-y-5 p-4 sm:p-6">
      {ocupado && <p role="status" className="flex items-center gap-2 text-xs text-zinc-400"><Loader2 size={15} className="animate-spin" /> Conferindo informações…</p>}
      {erro && <p role="alert" className="rounded-xl bg-orange-500/10 p-3 text-xs text-orange-200">{erro}</p>}
      {atual.relacionadas && <div className="rounded-xl border border-amber-400/25 bg-amber-400/5 p-4 text-xs leading-5 text-amber-100"><p className="font-bold">{atual.relacionadas.tipo === 'possivel' ? 'Possível nova tentativa de compra' : 'Arquivos comprados em outro pedido'}</p><p className="mt-1">{atual.relacionadas.quantidade} arquivo(s) desta seleção também aparecem em pedido(s) pago(s). {atual.relacionadas.tipo === 'possivel' ? 'O nome coincide, mas o cadastro é diferente. Confira a identidade antes de contatar.' : `${atual.relacionadas.restantes} arquivo(s) ainda não constam como comprados.`}</p><p className="mt-2 text-[10px]">Pedidos relacionados: {atual.relacionadas.pedidos.map(id => `#${id.slice(0, 8)}`).join(', ')}. Os pedidos foram preservados.</p></div>}
      <section><h3 className="text-sm font-bold">{proprio ? 'Valores dos seus arquivos' : 'Valores do pedido'}</h3>{atual.valores ? <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">{([
        ['Preço dos arquivos', atual.valores.subtotal], ['Descontos', -atual.valores.desconto], ['Após descontos', atual.valores.total], ['Comissão Retratt', -atual.valores.comissao], ['Royalty do organizador', -atual.valores.royalty], ['Antes da tarifa MP', atual.valores.antesTarifa],
      ] as const).map(([nome, valor]) => <div key={nome} className="rounded-xl border border-white/10 bg-black/40 p-3"><dt className="text-[10px] text-zinc-400">{nome}</dt><dd className="mt-1 text-sm font-bold">{moeda(valor)}</dd></div>)}</dl> : <p className="mt-2 text-xs text-zinc-400">Não foi possível conferir os valores desta participação. Nenhum valor foi estimado.</p>}
        <p className="mt-3 rounded-xl border border-white/10 p-3 text-xs leading-5 text-zinc-400">{atual.modelo === 'diaria_organizador' ? 'Recebimento pelo organizador. O repasse ao fotógrafo é manual, conforme o acordo entre vocês. O valor antes da tarifa MP não é o líquido final nem comprova repasse realizado.' : 'Recebimento direto pelo fotógrafo. A tarifa do Mercado Pago é separada das comissões.'}</p>
        {!proprio && atual.autores.length > 0 && <div className="mt-3 space-y-2">{atual.autores.map(autor => <div key={autor.nome} className="rounded-xl border border-white/10 p-3"><p className="text-xs font-bold">{autor.nome} · {autor.quantidade} arquivo(s)</p><p className="mt-1 text-[10px] leading-5 text-zinc-400">Vendas {moeda(autor.total)} · Retratt -{moeda(autor.comissao)} · Antes da tarifa MP {moeda(autor.antesTarifa)}</p></div>)}</div>}
      </section>
      {!proprio && <section className="rounded-xl border border-white/10 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-sm font-bold">Pagamento no Mercado Pago</h3><button type="button" disabled={ocupado || !atual.pagamentoId} onClick={() => void conferirMP()} className={botao}><RefreshCw size={14} /> Conferir método e tarifa</button></div><p className="mt-2 break-all text-[10px] text-zinc-500">{atual.pagamentoId ? `Transação ${atual.pagamentoId}` : 'Sem identificador de cobrança registrado. Isso não significa que um Pix foi gerado.'}</p>
        {detalhe?.erroMP && <p role="status" className="mt-3 text-xs text-orange-200">{detalhe.erroMP}</p>}
        {detalhe?.mercadoPago && <div className="mt-3 space-y-2 text-xs"><p>Método: <strong>{detalhe.mercadoPago.metodo}</strong> · Situação no MP: <strong>{detalhe.mercadoPago.status}</strong></p><p>Tarifa MP: {moeda(detalhe.mercadoPago.taxaCentavos)} · Líquido da transação: {moeda(detalhe.mercadoPago.liquidoCentavos)}</p>{detalhe.mercadoPago.aprovadoEm && <p>Aprovação: {quando(detalhe.mercadoPago.aprovadoEm)}</p>}{detalhe.mercadoPago.expiraEm && atual.situacao !== 'pago' && <p>Vencimento registrado: {quando(detalhe.mercadoPago.expiraEm)}</p>}<p className="text-[10px] text-zinc-500">Consulta em {quando(detalhe.mercadoPago.consultadoEm)}. Esta consulta não altera o pedido.</p></div>}
      </section>}
      <section><h3 className="text-sm font-bold">Histórico e entrega</h3><ol className="mt-3 space-y-2 text-xs">{[
        ['Pedido criado', quando(atual.criadoEm)],
        ...(!proprio ? [[atual.pagamentoId ? 'Cobrança registrada' : 'Pagamento não iniciado', atual.pagamentoId ? 'Horário de geração não registrado' : 'Checkout preparado, sem cobrança registrada']] : []),
        ['Pagamento aprovado', atual.pagoEm ? quando(atual.pagoEm) : 'Sem aprovação registrada'],
        ['Liberação dos arquivos', `${liberados}/${atual.quantidade} liberado(s) atualmente`],
        ...(!proprio ? [['E-mail de confirmação', atual.email?.enviadoEm ? `Envio registrado em ${quando(atual.email.enviadoEm)}; entrega na caixa de entrada não confirmada` : atual.email?.erro || 'Sem envio registrado']] : []),
        ['Acesso ao download', detalhe ? `${detalhe.downloads.solicitacoes} solicitação(ões) · ${detalhe.downloads.parcial ? 'pelo menos ' : ''}${detalhe.downloads.itensAcessados} arquivo(s) acessado(s)` : 'Consultando registros'],
      ].map(([nome, valor]) => <li key={nome} className="flex gap-3 rounded-xl bg-white/[0.03] p-3"><span className="mt-0.5 shrink-0 text-zinc-500"><Clock3 size={14} /></span><div><p className="font-bold">{nome}</p><p className="mt-1 leading-5 text-zinc-400">{valor}</p></div></li>)}</ol><p className="mt-2 text-[10px] leading-4 text-zinc-500">O registro de download comprova uma solicitação atendida; não confirma que o arquivo foi salvo no aparelho.{detalhe?.downloads.ultimoEm ? ` Último acesso: ${quando(detalhe.downloads.ultimoEm)}.` : ''}</p></section>
      <section><h3 className="text-sm font-bold">{proprio ? 'Seus arquivos neste pedido' : 'Arquivos selecionados'}</h3><div className="mt-3 space-y-2">{atual.itens.map(item => <div key={item.id} className="flex items-center gap-3 rounded-xl border border-white/10 p-3">
        {detalhe?.imagens.find(i => i.fotoId === item.fotoId) && <Image src={detalhe.imagens.find(i => i.fotoId === item.fotoId)!.url} alt="Prévia protegida do arquivo selecionado" width={56} height={56} unoptimized className="h-14 w-14 shrink-0 rounded-lg object-cover" />}
        <div className="min-w-0 flex-1"><p className="break-words text-xs font-bold">{item.titulo}</p><p className="mt-1 text-[10px] text-zinc-500">{item.autor}</p><p className="mt-1 text-[10px] text-zinc-400">{item.liberado ? `Liberado${item.expiraEm ? ` até ${quando(item.expiraEm)}` : ''}` : 'Download não liberado'}</p></div>
      </div>)}</div></section>
      {!proprio && <section className="rounded-xl border border-white/10 p-4"><h3 className="text-sm font-bold">Contato com o comprador</h3><p className="mt-2 text-xs leading-5 text-zinc-400">Prepare uma mensagem para revisar e copiar. Nenhum e-mail ou push é enviado por esta tela.</p><button type="button" disabled={ocupado || !atual.lembrete.permitido} onClick={() => void prepararLembrete()} className={`${botao} mt-3`}><FileText size={15} /> Preparar lembrete</button>{atual.lembrete.motivo && <p className="mt-2 text-xs text-amber-200">{atual.lembrete.motivo}</p>}
        {rascunho && <div className="mt-4 space-y-3"><p className="break-all text-xs text-zinc-300">Para: {rascunho.destinatario}</p><label className="block text-xs text-zinc-400">Assunto<input value={rascunho.assunto} onChange={e => { setRascunho({ ...rascunho, assunto: e.target.value }); setCopiado(false); }} className="mt-1 min-h-11 w-full rounded-lg border border-white/15 bg-black p-3 text-white" /></label><label className="block text-xs text-zinc-400">Mensagem<textarea value={rascunho.texto} onChange={e => { setRascunho({ ...rascunho, texto: e.target.value }); setCopiado(false); }} rows={10} className="mt-1 w-full resize-y rounded-lg border border-white/15 bg-black p-3 text-xs leading-5 text-white" /></label><button type="button" className={botao} onClick={() => { void navigator.clipboard.writeText(`Para: ${rascunho.destinatario}\nAssunto: ${rascunho.assunto}\n\n${rascunho.texto}`).then(() => setCopiado(true)).catch(() => setErro('Não foi possível copiar automaticamente. Selecione e copie o texto.')); }}><Copy size={14} />{copiado ? 'Mensagem copiada' : 'Copiar mensagem'}</button></div>}
      </section>}
    </div>
  </dialog>;
}

export default function AcompanhamentoVendasFotos({ perfil, semPainel = false, ativo = true }: { perfil: Perfil; semPainel?: boolean; ativo?: boolean }) {
  const router = useRouter();
  const [dados, setDados] = useState<Dados | null>(null), [carregando, setCarregando] = useState(true), [erro, setErro] = useState('');
  const [galeria, setGaleria] = useState(''), [busca, setBusca] = useState(''), [filtro, setFiltro] = useState('todos'), [pagina, setPagina] = useState(1);
  const [selecionado, setSelecionado] = useState<PedidoFotosPainel | null>(null);
  const sequencia = useRef(0), proprio = perfil === 'fotografo';
  useEffect(() => { if (!ativo) return; const id = new URLSearchParams(window.location.search).get('galeria'); if (!id || !/^[a-f0-9-]{36}$/i.test(id)) return; const timer = window.setTimeout(() => setGaleria(id), 0); return () => window.clearTimeout(timer); }, [perfil, ativo]);
  const consultar = useCallback(async <T,>(extra: Record<string, string> = {}, signal?: AbortSignal): Promise<T> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace(`/fotos/login?perfil=${perfil}&next=${encodeURIComponent(proprio ? '/fotos/fotografo/vendas' : '/fotos/admin/vendas')}`); throw new Error('Entre na sua conta para continuar.'); }
    const params = new URLSearchParams({ perfil, ...(galeria ? { galeria } : {}), ...extra });
    const r = await fetch(`/api/fotos/vendas-pedidos?${params}`, { headers: { Authorization: `Bearer ${session.access_token}` }, cache: 'no-store', signal: signal || AbortSignal.timeout(25000) });
    const payload = await r.json();
    if (!r.ok) throw new Error(payload.error || 'Não foi possível consultar os pedidos.');
    return payload as T;
  }, [perfil, galeria, proprio, router]);
  // A lista atualiza por ação do usuário; não disputa consultas com o checkout em andamento.
  const carregar = useCallback(async (signal?: AbortSignal) => {
    const atual = ++sequencia.current;
    setCarregando(true); setErro('');
    try { const d = await consultar<Dados>({}, signal); if (!signal?.aborted && atual === sequencia.current) { setDados(d); setPagina(1); } }
    catch (e) { if (!signal?.aborted && atual === sequencia.current) setErro(e instanceof Error ? e.message : 'Consulta indisponível.'); }
    finally { if (!signal?.aborted && atual === sequencia.current) setCarregando(false); }
  }, [consultar]);
  useEffect(() => { if (!ativo) return; const c = new AbortController(); const timer = window.setTimeout(() => void carregar(c.signal), 0); return () => { window.clearTimeout(timer); c.abort(); }; }, [carregar, ativo]);
  const pedidos = useMemo(() => dados?.pedidos || [], [dados]);
  const resumo = useMemo(() => {
    const pagos = pedidos.filter(p => p.situacao === 'pago');
    return { pagos: pagos.length, semValores: pagos.filter(p => !p.valores).length, total: pagos.reduce((s, p) => s + (p.valores?.total || 0), 0), arquivos: pagos.reduce((s, p) => s + p.quantidade, 0), pix: pedidos.filter(p => p.situacao === 'pix_pendente').length, checkouts: pedidos.filter(p => p.situacao === 'checkout_iniciado').length, conferir: pedidos.filter(p => p.relacionadas).length };
  }, [pedidos]);
  const filtrados = pedidos.filter(p => (filtro === 'todos' || filtro === 'relacionados' ? filtro !== 'relacionados' || Boolean(p.relacionadas) : p.situacao === filtro)
    && textoNormalizado([p.id, p.pagamentoId, p.comprador?.nome, p.comprador?.email, ...p.itens.map(i => i.autor)].filter(Boolean).join(' ')).includes(textoNormalizado(busca.trim())));
  const visiveis = filtrados.slice((pagina - 1) * 20, pagina * 20);
  const conteudo = <div className={proprio ? 'space-y-5' : 'space-y-6'}>

    <div className={s.filtros}><label className="min-w-0 flex-1 text-[10px] text-zinc-400">Galeria<select aria-label="Galeria dos pedidos" value={galeria || dados?.galeriaId || ''} disabled={carregando} onChange={e => { setGaleria(e.target.value); setSelecionado(null); setPagina(1); }} className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black px-3 text-xs text-white"><option value="" disabled>Escolha uma galeria</option>{dados?.galerias.map(g => <option key={g.id} value={g.id}>{g.nome}</option>)}</select></label><label className="min-w-0 flex-1 text-[10px] text-zinc-400">{proprio ? 'Buscar pedido' : 'Buscar comprador, e-mail ou pedido'}<div className="mt-1 flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-black px-3"><Search size={14} /><input aria-label="Buscar pedidos" value={busca} onChange={e => { setBusca(e.target.value); setPagina(1); }} placeholder="Digite para filtrar" className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none" /></div></label></div>
    {erro && <p role="alert" className="rounded-xl border border-orange-400/20 bg-orange-400/10 p-4 text-xs text-orange-100">{erro}</p>}
    {dados?.parcial && <p className="rounded-xl border border-amber-400/20 p-3 text-xs text-amber-200">Exibindo os {dados.limite} pedidos mais recentes desta galeria. Os totais abaixo correspondem a esse recorte. Lembretes estão desativados porque o histórico pode estar incompleto.</p>}
    {!proprio && dados?.galeriaId && <TarifasMercadoPago galeria={dados.galeriaId} />}
    {carregando && !dados ? <div role="status" className="flex min-h-48 items-center justify-center gap-3 text-sm text-zinc-400"><Loader2 className="animate-spin" size={22} /> Consultando seus pedidos…</div> : dados && <>
      {resumo.semValores > 0 && <p className="rounded-xl border border-amber-400/20 p-3 text-xs text-amber-200">{resumo.semValores} pedido(s) pago(s) não têm valores que puderam ser conferidos. Esses valores não foram incluídos na soma abaixo.</p>}
      <dl className={s.linhaResumo}>{[['Vendas pagas', `${resumo.pagos} · ${resumo.arquivos} arquivo(s)`], [proprio ? 'Suas vendas após descontos' : 'Vendas após descontos', moeda(resumo.total)], ['Pix aguardando pagamento', String(resumo.pix)], ['Checkouts iniciados', String(resumo.checkouts)]].map(([titulo, valor]) => <div key={titulo} className={undefined}><dt className="text-[10px] leading-4 text-zinc-400">{titulo}</dt><dd className="mt-2 break-words text-lg font-black sm:text-xl">{valor}</dd></div>)}</dl>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar situação dos pedidos">{[['todos', 'Todos'], ['pago', 'Pagos'], ['pix_pendente', 'Pix pendentes'], ['checkout_iniciado', 'Checkouts iniciados'], ['relacionados', `Compras relacionadas (${resumo.conferir})`], ['cobranca_gerada', 'Outras cobranças'], ['cancelado', 'Cancelados'], ['reembolsado', 'Reembolsados']].map(([id, nome]) => <button type="button" key={id} aria-pressed={filtro === id} onClick={() => { setFiltro(id); setPagina(1); }} className={`min-h-10 rounded-xl border px-3 py-2 text-[11px] font-bold ${filtro === id ? 'border-retratt bg-retratt text-black' : 'border-white/10 text-zinc-400 hover:text-white'}`}>{nome}</button>)}</div>
      <section className={s.secao}><header className={s.secaoCabecalho}><div><h2>Pedidos da galeria</h2><p>{filtrados.length} pedido(s) encontrado(s). {proprio ? 'Valores referentes somente aos seus arquivos.' : 'Abra um pedido para conferir pagamentos, entrega e histórico.'}</p></div></header><div className={s.rolagem} tabIndex={0} role="region" aria-label={proprio ? 'Pedidos do fotógrafo' : 'Pedidos do organizador'}><table className={s.tabela}><thead><tr><th>{proprio ? 'Pedido' : 'Comprador / pedido'}</th><th>Situação</th><th className={s.numero}>{proprio ? 'Seus arquivos' : 'Arquivos'}</th><th className={s.numero}>Após descontos</th><th>Recebimento</th><th /></tr></thead><tbody>{visiveis.map(p => <tr key={p.id}><td><strong>{!proprio && p.comprador?.nome ? p.comprador.nome : `#${p.id.slice(0,8)}`}</strong>{!proprio && p.comprador?.email && <small>{p.comprador.email}</small>}<small>{!proprio ? `#${p.id.slice(0,8)} · ` : ''}{quando(p.criadoEm)}</small>{p.relacionadas && <small className="text-amber-200">{p.relacionadas.tipo === 'possivel' ? 'Possível nova tentativa' : 'Arquivos em outro pedido pago'}</small>}</td><td><Situacao pedido={p} /></td><td className={s.numero}>{p.quantidade}</td><td className={s.numero}>{moeda(p.valores?.total)}</td><td>{p.modelo === 'diaria_organizador' ? proprio ? 'Organizador · diária' : 'Na sua conta · diária' : proprio ? 'Direto na sua conta' : 'Fotógrafo · royalty'}</td><td><button type="button" className={s.botao} onClick={() => setSelecionado(p)} aria-label={`Ver detalhes do pedido ${p.id.slice(0,8)}`}>Detalhes <ArrowUpRight size={13} /></button></td></tr>)}</tbody></table>{!visiveis.length && <p className={s.vazio}>{dados.galerias.length ? 'Nenhum pedido encontrado neste filtro.' : 'Você ainda não tem galerias para acompanhar.'}</p>}</div></section>
      {filtrados.length > 20 && <nav aria-label="Páginas dos pedidos" className="flex items-center justify-between gap-3 text-xs"><button className={botao} disabled={pagina === 1} onClick={() => setPagina(p => p - 1)}>Anterior</button><span>{pagina} / {Math.ceil(filtrados.length / 20)}</span><button className={botao} disabled={pagina * 20 >= filtrados.length} onClick={() => setPagina(p => p + 1)}>Próxima</button></nav>}
      <p className="flex items-start gap-2 text-[10px] leading-5 text-zinc-500"><CheckCircle2 size={13} className="mt-1 shrink-0" />Conferido em {quando(dados.atualizadoEm)}. Atualize para buscar novas compras. Pagamentos e entregas continuam sendo processados pelo fluxo normal da Retratt.</p>
    </>}
    {ativo && selecionado && <JanelaPedido key={selecionado.id} pedido={selecionado} perfil={perfil} consultar={consultar} fechar={() => setSelecionado(null)} />}
  </div>;
  if (semPainel) return <><div className="mb-4 flex justify-end"><button type="button" className={s.botao} disabled={carregando} onClick={() => void carregar()}><RefreshCw size={14} /> Atualizar pedidos</button></div>{conteudo}</>;
  return proprio ? <PainelFotografo pagina="vendas" titulo="Vendas e pedidos" descricao="Acompanhe pagamentos e a entrega dos seus arquivos por galeria. Abra um pedido para conferir os detalhes da sua participação." acoes={<button type="button" disabled={carregando} onClick={() => void carregar()} className={s.botao}><RefreshCw size={14} className={carregando ? 'animate-spin' : ''} /> Atualizar pedidos</button>}>{conteudo}</PainelFotografo> : <PainelOrganizador tela="vendas" titulo="Vendas e pedidos" descricao="Acompanhe compradores, pagamentos e a entrega das mídias. Pix pendente e checkout iniciado aparecem separados." acoes={<button type="button" disabled={carregando} onClick={() => void carregar()} className={s.botao}><RefreshCw size={14} className={carregando ? 'animate-spin' : ''} /> Atualizar pedidos</button>}>{conteudo}</PainelOrganizador>;
}
