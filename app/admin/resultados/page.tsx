'use client';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import { CompeticaoShell, campoCompeticao as campo, useEventoCompeticao } from '../_components/CompeticaoShell';
import { rotuloLuta } from '@/app/lib/lutas-rotulos';
type Luta = { id:string; id_visual:string; ordem?:number|null; categoria:string; faixa:string; fase:string; atleta_1:string; atleta_2:string; atleta_1_id:number|null; atleta_2_id:number|null; vencedor:string|null; status_luta:string };
type Rascunho = { lutaId:string; atleta1:number|null; atleta2:number|null; vencedor:number; metodo:string; motivo:string };
const metodos = { pontos:'Pontos',vantagens:'Vantagens',finalizacao:'Finalização',decisao:'Decisão do árbitro',desclassificacao:'Desclassificação',wo:'W.O.' };
export default function ResultadosPage() {
  const contexto = useEventoCompeticao();
  return <CompeticaoShell titulo="Resultados manuais" descricao="Registre a súmula conferida pelo organizador. O vencedor avança na chave; resultados concluídos não são sobrescritos." contexto={contexto}><Editor key={contexto.eventoId} eventoId={contexto.eventoId} /></CompeticaoShell>;
}
function Editor({ eventoId }: { eventoId: string }) {
  const contexto = { eventoId };
  const [lutas,setLutas] = useState<Luta[]>([]);
  const [lutaId,setLutaId] = useState('');
  const [vencedor,setVencedor] = useState('');
  const [metodo,setMetodo] = useState('pontos');
  const [motivo,setMotivo] = useState('');
  const [mensagem,setMensagem] = useState('');
  const [ocupado,setOcupado] = useState(false);
  const [rascunhos,setRascunhos] = useState<Rascunho[]>([]);
  const [chaveLocal,setChaveLocal] = useState('');
  const [online,setOnline] = useState(true);
  const carregar = useCallback(async () => {
    if (!contexto.eventoId) return;
    const {data,error}=await supabase.from('chaves').select('id,id_visual,ordem,categoria,faixa,fase,atleta_1,atleta_2,atleta_1_id,atleta_2_id,vencedor,status_luta').eq('evento_id',contexto.eventoId).order('categoria').order('ordem');
    if(error) { setMensagem('Sem conexão com as chaves. Os rascunhos deste navegador continuam disponíveis.'); return; }
    setLutas(data||[]);
  },[contexto.eventoId]);
  useEffect(() => {
    let ativo=true;
    const iniciar = window.setTimeout(() => { void carregar(); }, 0);
    void supabase.auth.getUser().then(({data})=>{
      if(!ativo||!data.user||!contexto.eventoId)return;
      const chave=`itatame:resultados:${data.user.id}:${contexto.eventoId}`;
      setChaveLocal(chave);
      try { const dados=JSON.parse(localStorage.getItem(chave)||'[]'); if(Array.isArray(dados))setRascunhos(dados); } catch { setMensagem('Não foi possível ler os rascunhos locais.'); }
    });
    return()=>{ativo=false;window.clearTimeout(iniciar);};
  },[contexto.eventoId,carregar]);
  useEffect(()=>{const atualizar=()=>setOnline(navigator.onLine);atualizar();window.addEventListener('online',atualizar);window.addEventListener('offline',atualizar);return()=>{window.removeEventListener('online',atualizar);window.removeEventListener('offline',atualizar);};},[]);
  const luta=lutas.find(l=>l.id===lutaId);
  function persistir(itens:Rascunho[]) {
    if(!chaveLocal)throw new Error('Aguarde a identificação do organizador.');
    localStorage.setItem(chaveLocal,JSON.stringify(itens));setRascunhos(itens);
  }
  function criarRascunho():Rascunho {
    if(!luta||!vencedor||motivo.trim().length<5)throw new Error('Selecione luta, vencedor e descreva o motivo do lançamento.');
    return {lutaId:luta.id,atleta1:luta.atleta_1_id,atleta2:luta.atleta_2_id,vencedor:Number(vencedor),metodo,motivo:motivo.trim()};
  }
  function guardar() {
    try {const item=criarRascunho();persistir([...rascunhos.filter(r=>r.lutaId!==item.lutaId),item]);setMensagem('Rascunho salvo neste navegador. Ainda não é um resultado oficial.');}
    catch(error){setMensagem((error as Error).message);}
  }
  async function registrar(item?:Rascunho) {
    setOcupado(true);
    try {
      const r=item||criarRascunho();
      const {error}=await supabase.rpc('registrar_resultado_manual',{p_luta:r.lutaId,p_vencedor:r.vencedor,p_atleta1:r.atleta1,p_atleta2:r.atleta2,p_metodo:r.metodo,p_motivo:r.motivo});
      if(error)throw new Error(error.code==='PGRST202'?'A atualização do banco para resultados manuais precisa ser instalada.':error.message);
      persistir(rascunhos.filter(x=>x.lutaId!==r.lutaId));setMensagem('Resultado registrado e avanço atualizado.');setVencedor('');setMotivo('');await carregar();
    }catch(error){setMensagem((error as Error).message+' O resultado não foi confirmado nesta tela. Confira ou mantenha um rascunho.');}
    finally{setOcupado(false);}
  }
  return <>
    <p className="text-sm mb-5 text-zinc-400">{online?'Conectado':'Sem conexão'} · Durante uma queda, use a chave impressa. Se esta página já estiver aberta, você também pode guardar rascunhos e enviá-los após reconectar.</p>
    <div className="grid lg:grid-cols-2 gap-6"><section className="p-5 rounded-2xl bg-zinc-900/50 border border-white/10 space-y-4">
      <label className="block text-xs">Luta<select className={campo} value={lutaId} onChange={e=>{setLutaId(e.target.value);setVencedor('');}}><option value="">Selecione uma luta pendente</option>{lutas.filter(l=>!l.vencedor&&l.status_luta!=='concluida').map(l=><option key={l.id} value={l.id}>{l.categoria} · {l.faixa} · {rotuloLuta(l)} · {l.atleta_1} x {l.atleta_2}</option>)}</select></label>
      {luta&&<p className="text-sm text-zinc-300">{luta.fase} · {luta.atleta_1} × {luta.atleta_2}</p>}
      <label className="block text-xs">Vencedor<select className={campo} value={vencedor} onChange={e=>setVencedor(e.target.value)}><option value="">Selecione o vencedor</option>{luta?.atleta_1_id&&<option value={luta.atleta_1_id}>{luta.atleta_1}</option>}{luta?.atleta_2_id&&<option value={luta.atleta_2_id}>{luta.atleta_2}</option>}</select></label>
      <label className="block text-xs">Método<select className={campo} value={metodo} onChange={e=>setMetodo(e.target.value)}>{Object.entries(metodos).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
      <label className="block text-xs">Justificativa / referência da súmula<textarea maxLength={1000} className={campo} value={motivo} onChange={e=>setMotivo(e.target.value)} placeholder="Ex.: resultado conferido na súmula após queda de internet"/></label>
      <div className="flex gap-3"><button disabled={ocupado||!chaveLocal} onClick={guardar} className="p-3 rounded-xl border border-white/20 text-sm disabled:opacity-40">Guardar rascunho</button><button disabled={ocupado||!online||!chaveLocal} onClick={()=>registrar()} className="p-3 rounded-xl bg-red-600 font-bold text-sm disabled:opacity-40">Confirmar resultado</button></div>
      <button onClick={carregar} disabled={ocupado} className="text-sm text-zinc-400 underline">Atualizar chaves</button>
    </section><section><h2 className="font-bold mb-4">Rascunhos ainda não enviados ({rascunhos.length})</h2><div className="space-y-3">{rascunhos.map(r=>{const lutaRascunho=lutas.find(l=>l.id===r.lutaId);return <article key={r.lutaId} className="p-4 rounded-xl border border-amber-500/30"><p className="text-xs">{lutaRascunho ? `${lutaRascunho.categoria} · ${rotuloLuta(lutaRascunho)}` : 'Confronto salvo'}</p><p className="text-sm mt-2">Vencedor: atleta #{r.vencedor} · {metodos[r.metodo as keyof typeof metodos]}</p><p className="text-zinc-400 text-sm">{r.motivo}</p><button onClick={()=>registrar(r)} disabled={ocupado||!online} className="mt-3 text-sm text-amber-300 disabled:opacity-40">Conferir no servidor e registrar</button></article>})}</div><p className="mt-5 text-xs text-zinc-500">Rascunhos ficam apenas neste navegador. Não limpe seus dados antes de registrar as súmulas.</p></section></div>
    {mensagem&&<p role="status" className="mt-5 p-4 border border-white/10 rounded-xl text-sm">{mensagem}</p>}
  </>;
}
