'use client';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import { CompeticaoShell, campoCompeticao as campo, useEventoCompeticao } from '../_components/CompeticaoShell';
import { rotuloLuta } from '@/app/lib/lutas-rotulos';
import { bloqueioResultadoManual, type LutaResultadoManual } from '@/app/lib/resultados-manuais';
import { normalizarTextoLocalidade } from '@/app/lib/localidades';
type Luta = LutaResultadoManual;
type Rascunho = { lutaId:string; atleta1:number|null; atleta2:number|null; vencedor:number; metodo:string; motivo:string; operacaoId:string; tatame:string|null; base1:any; base2:any; placar1:any; placar2:any; contingencia:boolean };
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
  const [contingencia,setContingencia] = useState(false);
  const [placares,setPlacares] = useState([[0,0,0],[0,0,0]]);
  const [mensagem,setMensagem] = useState('');
  const [ocupado,setOcupado] = useState(false);
  const [rascunhos,setRascunhos] = useState<Rascunho[]>([]);
  const [chaveLocal,setChaveLocal] = useState('');
  const [online,setOnline] = useState(true);
  const [busca,setBusca] = useState('');
  const [consultaOk,setConsultaOk] = useState(false);
  const carregar = useCallback(async () => {
    if (!contexto.eventoId) return;
    setConsultaOk(false);
    try {
      const todas: Luta[] = [];
      for (let pagina = 0; ; pagina++) {
        const {data,error}=await supabase.from('chaves').select('id,id_visual,ordem,categoria,categoria_id,faixa,fase,proxima_luta,atleta_1,atleta_2,atleta_1_id,atleta_2_id,vencedor,vencedor_id,status_luta,iniciada_em,tatame,pontuacao_atleta_1,pontuacao_atleta_2')
          .eq('evento_id',contexto.eventoId).order('categoria').order('ordem').order('id').range(pagina * 500, pagina * 500 + 499);
        if(error) throw error;
        todas.push(...(data || []));
        if((data || []).length < 500) break;
      }
      setLutas(todas); setConsultaOk(true);
    } catch { setMensagem('Sem conexão com as chaves. Os rascunhos deste navegador continuam disponíveis. Atualize antes de confirmar resultados.'); }

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
  const bloqueio = luta ? bloqueioResultadoManual(lutas, luta, contingencia) : '';
  const termo = normalizarTextoLocalidade(busca);
  const opcoes = lutas.filter(l => !l.vencedor && l.status_luta !== 'concluida'
    && normalizarTextoLocalidade(`${l.atleta_1} ${l.atleta_2} ${l.categoria} ${l.faixa} ${rotuloLuta(l)}`).includes(termo));
  function persistir(itens:Rascunho[]) {
    if(!chaveLocal)throw new Error('Aguarde a identificação do organizador.');
    localStorage.setItem(chaveLocal,JSON.stringify(itens));setRascunhos(itens);
  }
  function criarRascunho():Rascunho {
    if(!luta||!vencedor||![luta.atleta_1_id,luta.atleta_2_id].includes(Number(vencedor))||motivo.trim().length<5)throw new Error('Selecione luta, vencedor e descreva o motivo do lançamento.');
    const atual=luta as any;
    return {lutaId:luta.id,atleta1:luta.atleta_1_id,atleta2:luta.atleta_2_id,vencedor:Number(vencedor),metodo,motivo:motivo.trim(),operacaoId:crypto.randomUUID(),tatame:atual.tatame??null,base1:atual.pontuacao_atleta_1,base2:atual.pontuacao_atleta_2,placar1:{pontos:placares[0][0],vantagens:placares[0][1],punicoes:placares[0][2]},placar2:{pontos:placares[1][0],vantagens:placares[1][1],punicoes:placares[1][2]},contingencia};
  }
  function rasccunhosSemItem(r:Rascunho){return rascunhos.filter(x=>x.lutaId!==r.lutaId);}
  function guardar() {
    try {if(rascunhos.some(r=>r.lutaId===lutaId))throw new Error('Já existe uma súmula pendente para esta luta. Confira e registre o rascunho preservado.');const item=criarRascunho();persistir([...rascunhos.filter(r=>r.lutaId!==item.lutaId),item]);setMensagem('Rascunho salvo neste navegador. Ainda não é um resultado oficial.');}
    catch(error){setMensagem((error as Error).message);}
  }
  async function registrar(item?:Rascunho) {
    if (ocupado || !consultaOk || !online) return;
    setOcupado(true);
    try {
      const r=item||rascunhos.find(x=>x.lutaId===lutaId)||criarRascunho();
      if(!r.operacaoId)throw new Error('Rascunho antigo: confira a súmula e guarde um novo antes de registrar.');
      if(!rascunhos.some(x=>x.operacaoId===r.operacaoId))persistir([...rascunhos.filter(x=>x.lutaId!==r.lutaId),r]);
      const atual=lutas.find(l=>l.id===r.lutaId);
      if(!atual) throw new Error('Luta não encontrada. Atualize as chaves.');
      if(atual.atleta_1_id!==r.atleta1 || atual.atleta_2_id!==r.atleta2) throw new Error('Os atletas mudaram desde o rascunho. Confira a súmula novamente.');
      const impedimento=atual.status_luta==='concluida'&&item ? '' : bloqueioResultadoManual(lutas,atual,r.contingencia);
      if(impedimento) throw new Error(impedimento);
      const nomeVencedor=r.vencedor===atual.atleta_1_id?atual.atleta_1:atual.atleta_2;
      if(!window.confirm(`Confirmar resultado oficial?\n${atual.categoria} · ${atual.faixa} · ${rotuloLuta(atual)}\n${atual.atleta_1} × ${atual.atleta_2}\nVencedor: ${nomeVencedor}\nMétodo: ${metodos[r.metodo as keyof typeof metodos]}\nO vencedor avançará na chave.`)) return;
      const {data:{session}}=await supabase.auth.getSession();
      if(!session) throw new Error('Sessão expirada. Entre novamente.');
      const resposta=await fetch('/api/organizador/resultados',{
        method:'POST',signal:AbortSignal.timeout(25000),headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},
        body:JSON.stringify({...r,eventoId:contexto.eventoId}),
      });
      const dados=await resposta.json().catch(()=>null);
      if(!resposta.ok||!dados?.success) throw new Error(dados?.error||'Não foi possível conferir o resultado no servidor.');
      localStorage.setItem(chaveLocal+':recibo:'+r.operacaoId,JSON.stringify({rascunho:r,recibo:dados.operacao_id,confirmadoEm:new Date().toISOString()}));
      persistir(rasccunhosSemItem(r));setMensagem('Resultado registrado e avanço atualizado.');setVencedor('');setMotivo('');await carregar();
    }catch(error){setMensagem((error as Error).message+' Confira a chave antes de tentar novamente. O rascunho foi preservado.');}
    finally{setOcupado(false);}
  }

  return <>
    <p className="text-sm mb-5 text-zinc-400">{online?'Conectado':'Sem conexão'} · Durante uma queda, use a chave impressa. Se esta página já estiver aberta, você também pode guardar rascunhos e enviá-los após reconectar.</p>
    <div className="grid lg:grid-cols-2 gap-6"><section aria-labelledby="titulo-lancamento-manual" className="p-5 rounded-2xl bg-amber-500/[0.05] border-2 border-amber-400/40 space-y-4 shadow-lg shadow-amber-950/10">
      <div><p className="text-[10px] font-bold uppercase tracking-widest text-amber-300">Súmula conferida</p><h2 id="titulo-lancamento-manual" className="mt-1 text-lg font-bold">Lançamento manual de resultado</h2><p className="mt-2 text-xs leading-relaxed text-zinc-400">Registre na ordem da chave. Lutas anteriores pendentes e resultados concluídos ficam protegidos. Para uma luta iniciada online, confirme abaixo que ela foi encerrada no papel. Rascunho ainda não altera a competição.</p></div>
      <label className="flex gap-2 text-xs text-amber-200"><input type="checkbox" checked={contingencia} onChange={e=>setContingencia(e.target.checked)}/>Contingência: o organizador confirma que a luta foi encerrada no papel e que o placar digital não está mais sendo operado.</label>
      <label className="block text-xs">Buscar por atleta, categoria ou luta<input type="search" value={busca} onChange={e=>{setBusca(e.target.value);setLutaId('');setVencedor('');}} className={campo+' mt-2'} placeholder="Digite o nome do atleta" /></label>
      <p className="text-xs text-zinc-400">{opcoes.filter(l=>!bloqueioResultadoManual(lutas,l,contingencia)).length} luta(s) disponível(is) neste filtro.</p>
      <label className="block text-xs">Luta<select className={campo} value={lutaId} onChange={e=>{setLutaId(e.target.value);setVencedor('');}}><option value="">Selecione uma luta pendente</option>{opcoes.map(l=><option key={l.id} value={l.id} disabled={Boolean(bloqueioResultadoManual(lutas,l))}>{l.categoria} · {l.faixa} · {rotuloLuta(l)} · {l.atleta_1} x {l.atleta_2}{bloqueioResultadoManual(lutas,l) ? ' — bloqueada: '+bloqueioResultadoManual(lutas,l) : ''}</option>)}</select></label>
      {bloqueio&&<p role="alert" className="rounded-xl border border-amber-400/30 p-3 text-xs text-amber-200">{bloqueio}</p>}
      {luta&&<p className="text-sm text-zinc-300">{luta.fase} · {luta.atleta_1} × {luta.atleta_2}</p>}
      <label className="block text-xs">Vencedor<select disabled={Boolean(bloqueio)} className={campo} value={vencedor} onChange={e=>setVencedor(e.target.value)}><option value="">Selecione o vencedor</option>{luta?.atleta_1_id&&<option value={luta.atleta_1_id}>{luta.atleta_1}</option>}{luta?.atleta_2_id&&<option value={luta.atleta_2_id}>{luta.atleta_2}</option>}</select></label>
      <label className="block text-xs">Método<select className={campo} value={metodo} onChange={e=>setMetodo(e.target.value)}>{Object.entries(metodos).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
      <fieldset className="space-y-2"><legend className="text-xs font-bold">Placar final da súmula</legend>{['Azul (atleta 1)','Vermelho (atleta 2)'].map((nome,lado)=><div key={nome} className="grid grid-cols-3 gap-2"><p className="col-span-3 text-xs">{nome}</p>{['Pontos','Vantagens','Punições'].map((rotulo,col)=><label key={rotulo} className="text-xs">{rotulo}<input type="number" min="0" max="999" value={placares[lado][col]} onChange={e=>setPlacares(p=>p.map((val,n)=>n===lado?val.map((v,i)=>i===col?Number(e.target.value):v):val))} className={campo}/></label>)}</div>)}</fieldset>
      <label className="block text-xs">Justificativa / referência da súmula<textarea maxLength={1000} className={campo} value={motivo} onChange={e=>setMotivo(e.target.value)} placeholder="Ex.: resultado conferido na súmula após queda de internet"/></label>
      <div className="flex gap-3"><button disabled={ocupado||!chaveLocal} onClick={guardar} className="p-3 rounded-xl border border-white/20 text-sm disabled:opacity-40">Guardar rascunho</button><button disabled={ocupado||!online||!chaveLocal||!consultaOk||!luta||Boolean(bloqueio)||!vencedor||motivo.trim().length<5} onClick={()=>registrar()} className="p-3 rounded-xl bg-red-600 font-bold text-sm disabled:opacity-40">Confirmar resultado</button></div>
      <button onClick={carregar} disabled={ocupado} className="text-sm text-zinc-400 underline">Atualizar chaves</button>
    </section><section><h2 className="font-bold mb-4">Rascunhos ainda não enviados ({rascunhos.length})</h2><div className="space-y-3">{rascunhos.map(r=>{const lutaRascunho=lutas.find(l=>l.id===r.lutaId);return <article key={r.lutaId} className="p-4 rounded-xl border border-amber-500/30"><p className="text-xs">{lutaRascunho ? `${lutaRascunho.categoria} · ${rotuloLuta(lutaRascunho)}` : 'Confronto salvo'}</p><p className="text-sm mt-2">Vencedor: atleta #{r.vencedor} · {metodos[r.metodo as keyof typeof metodos]}</p><p className="text-zinc-400 text-sm">{r.motivo}</p><button onClick={()=>registrar(r)} disabled={ocupado||!online||!consultaOk} className="mt-3 text-sm text-amber-300 disabled:opacity-40">Conferir no servidor e registrar</button></article>})}</div><p className="mt-5 text-xs text-zinc-500">Rascunhos ficam apenas neste navegador. Não limpe seus dados antes de registrar as súmulas.</p></section></div>
    {mensagem&&<p role="status" className="mt-5 p-4 border border-white/10 rounded-xl text-sm">{mensagem}</p>}
  </>;
}

