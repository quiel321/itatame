"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/app/lib/supabase';

type Posicao = { luta: string; lado: number; atleta: string; equipe: string; divisao: string; faixa: string; ordem: number; fase: string; peso: string | null };
type Categoria = { categoria_id: string; nome: string; publicada: boolean; revisao: number; travada: boolean; posicoes: Posicao[] };
const chave = (p: Posicao) => `${p.luta}:${p.lado}`;

export default function RevisaoChavesOrganizador({ eventoId, atualizacao }: { eventoId: string; atualizacao: string }) {
 const [categorias, setCategorias] = useState<Categoria[]>([]);
 const [categoriaId, setCategoriaId] = useState('');
 const [primeira, setPrimeira] = useState('');
 const [segunda, setSegunda] = useState('');
 const [motivo, setMotivo] = useState('');
 const [mensagem, setMensagem] = useState('');
 const [ocupado, setOcupado] = useState(false);
 const [revisaoAberta, setRevisaoAberta] = useState(false);
 const aviso = useRef<HTMLDivElement>(null);
 const pedido = useRef(0);
 const carregar = useCallback(async () => {
  const numero = ++pedido.current;
  setPrimeira(''); setSegunda('');
  if (!eventoId) { setCategorias([]); return; }
  const { data, error } = await supabase.rpc('chaves_revisao_listar', { p_evento: eventoId });
  if (numero !== pedido.current) return;
  if (error) { setCategorias([]); setMensagem(`Revisão indisponível: ${error.message}`); return; }
  setCategorias(data || []);
  setRevisaoAberta(false);
  setCategoriaId(anterior => (data || []).some((c: Categoria) => c.categoria_id === anterior) ? anterior : data?.[0]?.categoria_id || '');
 }, [eventoId]);
 useEffect(() => { const inicio = window.setTimeout(() => { void carregar(); }, 0); return () => window.clearTimeout(inicio); }, [carregar, atualizacao]);
 const categoria = categorias.find(c => c.categoria_id === categoriaId);
 const a = categoria?.posicoes.find(p => chave(p) === primeira);
 const b = categoria?.posicoes.find(p => chave(p) === segunda);
 const podeTrocar = !!a && !!b && primeira !== segunda && a.divisao === b.divisao && a.faixa === b.faixa && motivo.trim().length >= 3;
 const rascunhos = categorias.filter(c => !c.publicada);
 const todasPublicadas = categorias.length > 0 && rascunhos.length === 0;
 const expandido = !todasPublicadas || revisaoAberta;
 const trocaSelecionada = Boolean(primeira || segunda);
 async function publicarTodas() {
  if (ocupado || !rascunhos.length || trocaSelecionada) return;
  setOcupado(true);
  try {
   const { data, error } = await supabase.rpc('chaves_publicar_todas', {
    p_evento: eventoId, p_categorias: rascunhos.map(c => ({ categoria_id: c.categoria_id, revisao: c.revisao })),
   });
   if (error) setMensagem(error.message);
   else setMensagem(`${data?.publicadas || 0} categoria(s) publicada(s) para atletas, público e operadores.`);
   await carregar();
  } catch { setMensagem('Não foi possível confirmar a publicação. Atualize a revisão para conferir o estado das chaves.'); }
  finally { setOcupado(false); aviso.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
 }
 async function agir(acao: string) {
  if (!categoria || ocupado || (acao === 'publicar' && trocaSelecionada)) return;
  setOcupado(true);
  try {
   const { error } = await supabase.rpc('chaves_revisar', {
    p_categoria: categoria.categoria_id, p_revisao: categoria.revisao, p_acao: acao,
    p_luta_a: a?.luta || null, p_lado_a: a?.lado || null,
    p_luta_b: b?.luta || null, p_lado_b: b?.lado || null, p_motivo: motivo.trim() || null,
   });
   if (error) { setMensagem(error.message); return; }
   setMensagem(acao === 'publicar' ? 'Categoria publicada para atletas, público e operadores.' : acao === 'revisar' ? 'Categoria retirada da divulgação para revisão.' : 'Troca salva em rascunho. Você pode ajustar outras categorias e publicar todas ao final.');
   await carregar(); setMotivo('');
  } catch { setMensagem('Não foi possível confirmar a alteração. Atualize a revisão para conferir antes de tentar novamente.'); }
  finally { setOcupado(false); aviso.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }

 }
 return <section className="rounded-2xl border border-cyan-500/20 bg-[#111116] p-4 md:p-6 space-y-4">
  <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold text-lg">Revisar e publicar chaves</h2>{todasPublicadas ? <p className="mt-1 text-xs text-green-400">Todas as chaves publicadas · {categorias.length} categoria(s)</p> : <p className="text-xs text-zinc-400 mt-1">Confira as categorias, salve as trocas e publique as chaves.</p>}</div>{todasPublicadas && <button type="button" aria-expanded={expandido} aria-controls="conteudo-revisao-chaves" onClick={()=>setRevisaoAberta(v=>!v)} className="min-h-11 rounded-lg border border-cyan-500/30 px-3 text-xs text-cyan-200">{expandido ? 'Recolher revisão' : 'Ver revisão das chaves'}</button>}</div>
  <div ref={aviso} role="status" className={mensagem ? 'rounded-xl border border-cyan-500/30 p-3 text-sm text-cyan-200' : ''}>{mensagem}</div>
  <div id="conteudo-revisao-chaves" hidden={!expandido} className="space-y-4">
  <button disabled={ocupado} onClick={() => void carregar()} className="text-xs text-cyan-300">Atualizar revisão</button>
  {!categorias.length ? <p className="text-sm text-zinc-400">Gere as chaves para iniciar a revisão.</p> : <>
   <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-3 space-y-2">
    <p className="text-xs text-zinc-300">{rascunhos.length} em rascunho · {categorias.length - rascunhos.length} publicada(s)</p>
    <button disabled={ocupado || !rascunhos.length || trocaSelecionada} onClick={() => void publicarTodas()} className="w-full rounded-xl bg-green-600 p-3 font-bold text-sm disabled:opacity-40">{ocupado ? 'Aguarde...' : rascunhos.length ? `Publicar todas as chaves (${rascunhos.length})` : 'Todas as chaves publicadas'}</button>
    <p className="text-xs text-zinc-400">Cada troca salva fica guardada no servidor sem divulgar a categoria. Você pode sair e continuar depois. Este botão publica todos os rascunhos juntos.</p>
    {trocaSelecionada && <p className="text-xs text-yellow-200">Salve a troca selecionada ou <button disabled={ocupado} onClick={() => { setPrimeira(''); setSegunda(''); }} className="underline">limpe a seleção</button> antes de publicar todas.</p>}
   </div>
   <select aria-label="Categoria para revisão" value={categoriaId} disabled={ocupado} onChange={e => { setCategoriaId(e.target.value); setPrimeira(''); setSegunda(''); setMotivo(''); setMensagem(''); }} className="w-full min-w-0 rounded-xl bg-black border border-white/15 p-3 text-sm">
    {categorias.map(c => <option key={c.categoria_id} value={c.categoria_id}>{c.nome} · {c.travada ? 'Em operação' : c.publicada ? 'Publicada' : 'Rascunho'}</option>)}
   </select>
   {categoria && <>
    <p className="text-sm font-semibold text-cyan-200">{categoria.travada ? 'Em operação · posições protegidas' : categoria.publicada ? 'Publicada · visível para todos' : 'Rascunho · visível somente para você'}</p>
    {categoria.travada && <p className="text-xs text-zinc-400">Check-in fechado, chamadas, presença no tatame ou resultados impedem novas trocas.</p>}
    <div className="space-y-2">{categoria.posicoes.map(p => <div key={chave(p)} className="rounded-xl bg-black/40 border border-white/10 p-3">
     <div className="text-[11px] text-zinc-500">Luta {p.ordem} · {p.fase} · posição {p.lado}</div>
     <p className="text-sm font-semibold break-words">{p.atleta}</p><p className="text-xs text-zinc-400 break-words">{p.equipe || 'Equipe não informada'} · {p.peso ? `${p.peso} kg` : 'Peso não informado'}</p>
     <p className="text-[11px] text-zinc-500 break-words">{p.divisao} · {p.faixa}</p>
    </div>)}</div>
    {!categoria.travada && <>
     {(!categoria.publicada || motivo) && <label className="block text-xs text-zinc-400">Motivo da revisão / troca<input value={motivo} disabled={ocupado} onChange={e => setMotivo(e.target.value)} className="mt-1 w-full rounded-xl bg-black border border-white/15 p-3 text-white" placeholder="Descreva o ajuste necessário" /></label>}
     {categoria.publicada ? <>
      {!motivo && <label className="block text-xs text-zinc-400">Motivo para revisar<input value={motivo} onChange={e => setMotivo(e.target.value)} className="mt-1 w-full rounded-xl bg-black border border-white/15 p-3 text-white" placeholder="Descreva o ajuste necessário" /></label>}
      <button disabled={ocupado || motivo.trim().length < 3} onClick={() => void agir('revisar')} className="w-full rounded-xl border border-yellow-500/40 p-3 text-sm text-yellow-200 disabled:opacity-40">Retirar da divulgação e revisar</button>
     </> : <>
      <div className="grid gap-2 sm:grid-cols-2">{[1, 2].map(n => <select key={n} aria-label={`Atleta ${n} para troca`} disabled={ocupado} value={n === 1 ? primeira : segunda} onChange={e => n === 1 ? setPrimeira(e.target.value) : setSegunda(e.target.value)} className="w-full min-w-0 rounded-xl bg-black border border-white/15 p-3 text-sm"><option value="">Escolha o atleta {n}</option>{categoria.posicoes.filter(p => n === 1 || !a || (p.divisao === a.divisao && p.faixa === a.faixa)).map(p => <option key={chave(p)} value={chave(p)}>{p.atleta} · luta {p.ordem}, posição {p.lado}</option>)}</select>)}</div>
      <button disabled={ocupado || !podeTrocar} onClick={() => void agir('trocar')} className="w-full rounded-xl border border-white/20 p-3 text-sm disabled:opacity-40">Salvar troca em rascunho</button>
      <p className="text-xs text-zinc-400">Trocar posições pode mudar a separação de equipes definida pelo sorteio. Confira os confrontos no PDF antes de publicar.</p>
      <button disabled={ocupado || trocaSelecionada} onClick={() => void agir('publicar')} className="w-full rounded-xl bg-green-600 p-3 font-bold text-sm disabled:opacity-40">Publicar chaves desta categoria</button>
     </>}
    </>}
   </>}
  </>}
  </div>
 </section>;
}
