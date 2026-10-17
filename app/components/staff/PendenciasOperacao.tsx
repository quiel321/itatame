'use client';
import { useEffect, useState } from 'react';
import { arquivarConflito, pendenciasOperacao, type PedidoOperacao } from '@/app/lib/operacao-persistente';
import { contextoOperacao, recuperarOperacao } from '@/app/lib/operacao-segura';
const nomes: Record<string,string> = { checkin:'Pesagem',recepcao:'Recepção',wo:'Ausência no tatame',controle:'Presença/chamada',chamar:'Liberação ao tatame',iniciar:'Início da luta',pontuacao:'Pontuação',relogio:'Cronômetro',finalizar:'Resultado',corrigir:'Correção de resultado' };
export default function PendenciasOperacao({ compacto = false }: { compacto?: boolean }) {
  const [itens,setItens] = useState<PedidoOperacao[]>([]);
  const [erro,setErro] = useState('');
  const [ocupado,setOcupado] = useState('');
  const [conflito,setConflito] = useState<{pedido:PedidoOperacao;recusa:string}|null>(null);
  const [conferido,setConferido] = useState(false);
  const [aberto,setAberto] = useState(false);
  useEffect(() => {
    const atualizar = () => { try { setItens(pendenciasOperacao(localStorage,contextoOperacao())); } catch (e) { setErro((e as Error).message); } };
    atualizar();
    window.addEventListener('itatame:pendencias-alteradas',atualizar);
    window.addEventListener('itatame:operacao-confirmada',atualizar);
    window.addEventListener('storage',atualizar);
    const t=window.setInterval(atualizar,5000);
    return()=>{clearInterval(t);window.removeEventListener('itatame:pendencias-alteradas',atualizar);window.removeEventListener('itatame:operacao-confirmada',atualizar);window.removeEventListener('storage',atualizar);};
  },[]);
  async function conferir(p:PedidoOperacao) {
    setOcupado(p.id);setErro('');setConflito(null);setConferido(false);
    try { await recuperarOperacao(p);setItens(pendenciasOperacao(localStorage,contextoOperacao())); }
    catch(e){const mensagem=(e as Error).message;setErro(mensagem);if(mensagem.startsWith('Conflito:'))setConflito({pedido:p,recusa:mensagem});}
    finally{setOcupado('');}
  }
  if(!itens.length&&!erro)return null;
  // No placar, confirmações rápidas não piscam sobre a luta. Pendências reais
  // continuam protegidas e acessíveis pelo botão, sem abrir um aviso a cada pausa.
  if(compacto&&!aberto) {
    if(!erro&&!itens.some(p=>Date.now()-Date.parse(p.criada)>1500))return null;
    return <button type="button" onClick={()=>setAberto(true)} className="float-right m-2 rounded-lg border border-amber-400/50 bg-black/90 px-3 py-2 text-xs font-bold text-amber-200">Conferir sincronização ({itens.length})</button>;
  }
  return <section aria-label="Ações sem confirmação" className={`${compacto?'absolute right-2 top-2 max-h-[80vh] w-[min(36rem,calc(100vw-1rem))] overflow-y-auto rounded-xl border':'border-b'} border-amber-400/40 bg-amber-950 p-3 text-xs text-amber-100`}>
    {compacto&&<button type="button" onClick={()=>setAberto(false)} className="float-right rounded border px-3 py-2">Recolher</button>}
    <p className="font-bold">{itens.length} ação(ões) sem confirmação</p>
    <p className="mt-1">Preservadas neste aparelho. Confira antes de repetir ou trocar de posto. Conflitos precisam da conferência do organizador; não limpe o navegador.</p>
    {itens.map(p=><div key={p.id} className="mt-2 flex flex-wrap items-center justify-between gap-2"><span>{nomes[p.tipo]} · registro {p.alvo.slice(-8)}</span><button type="button" disabled={Boolean(ocupado)} onClick={()=>void conferir(p)} className="min-h-11 rounded-lg border border-amber-300/40 px-3 disabled:opacity-40">{ocupado===p.id?'Conferindo…':'Conferir ação pendente'}</button></div>)}
    {erro&&<p role="alert" className="mt-2 font-bold">{erro}</p>}
    {conflito&&<div className="mt-3 border-t border-amber-300/30 pt-3"><label className="flex gap-2"><input type="checkbox" checked={conferido} onChange={e=>setConferido(e.target.checked)}/>O organizador conferiu o estado atual no sistema e resolveu esta divergência. Esta tentativa recusada pode ser arquivada.</label><button type="button" disabled={!conferido||Boolean(ocupado)} className="mt-2 min-h-11 rounded-lg border px-3 disabled:opacity-40" onClick={()=>{try{arquivarConflito(localStorage,conflito.pedido,conflito.recusa);setConflito(null);setErro('');window.dispatchEvent(new Event('itatame:pendencias-alteradas'));}catch(e){setErro((e as Error).message);}}}>Guardar cópia e arquivar tentativa recusada</button></div>}
  </section>;
}
