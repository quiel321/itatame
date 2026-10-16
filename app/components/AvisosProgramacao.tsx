'use client';
import {useEffect,useRef,useState} from 'react';
import {processarAvisosPendentes,solicitarAvisos} from '@/app/lib/avisos-operacao-cliente';
type Modo='novos'|'reenvio';
type Previa={modo:Modo;total:number;jaRegistrados:number;aguardando:number;bloqueadoAte:string|null;semProgramacao:number;versao:string;amostra:string[];destinatarios:{atletas:number;responsaveis:number;contas:number;aparelhos:number;avisosComAparelho:number;avisosSemAparelho:number}};
export default function AvisosProgramacao({eventoId,bloqueado=false}:{eventoId:string;bloqueado?:boolean}) {
 const [previa,setPrevia]=useState<Previa|null>(null),[ocupado,setOcupado]=useState(false),[mensagem,setMensagem]=useState(''),[confirmarReenvio,setConfirmarReenvio]=useState(false);
 const trava=useRef(false),contexto=useRef(0);
 useEffect(()=>{contexto.current++;setPrevia(null);setMensagem('');setConfirmarReenvio(false);},[eventoId,bloqueado]);
 useEffect(()=>{if(!eventoId)return;const t=setInterval(()=>void processarAvisosPendentes(eventoId).catch(()=>{}),30000);return()=>clearInterval(t);},[eventoId]);
 async function conferir(modo:Modo){
  if(trava.current||bloqueado)return;
  trava.current=true;setOcupado(true);setMensagem('');setPrevia(null);setConfirmarReenvio(false);const atual=contexto.current;
  try{const p=await solicitarAvisos(eventoId,{acao:'previa_programacao',modo});if(contexto.current===atual)setPrevia(p);}
  catch(e){if(contexto.current===atual)setMensagem((e as Error).message);}
  finally{trava.current=false;setOcupado(false);}
 }
 async function enviar(){
  if(!previa||bloqueado||trava.current||previa.bloqueadoAte||(previa.modo==='reenvio'&&!confirmarReenvio))return;
  trava.current=true;setOcupado(true);const atual=contexto.current;
  try{
   const r=await solicitarAvisos(eventoId,{acao:'programacao',modo:previa.modo,confirmado:true,confirmar_reenvio:previa.modo==='reenvio'&&confirmarReenvio,versao:previa.versao});
   if(contexto.current===atual){setMensagem(`${r.registrados} aviso(s) registrado(s) para ${previa.modo==='reenvio'?'reenvio':'envio'}. Serão tentados nos aparelhos cadastrados dos atletas e responsáveis. Isso não confirma recebimento ou leitura.`);setPrevia(null);setConfirmarReenvio(false);}
  }catch(e){if(contexto.current===atual){setMensagem((e as Error).message);setPrevia(null);setConfirmarReenvio(false);}}
  finally{trava.current=false;setOcupado(false);}
 }
 return <details className="mb-5 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3 text-xs text-zinc-300">
  <summary className="cursor-pointer font-bold text-cyan-200">Avisar atletas sobre horário e tatame</summary>
  <p className="mt-3">Usa a programação salva das categorias publicadas. Nenhuma mensagem é enviada antes da sua confirmação.</p>
  {bloqueado&&<p className="mt-2 text-amber-200">Salve a distribuição antes de conferir os avisos.</p>}
  <div className="mt-3 flex flex-wrap gap-2">
   <button type="button" disabled={!eventoId||ocupado||bloqueado} onClick={()=>void conferir('novos')} className="min-h-11 rounded-lg border border-cyan-400/30 px-3 disabled:opacity-40">Conferir novos avisos</button>
   <button type="button" disabled={!eventoId||ocupado||bloqueado} onClick={()=>void conferir('reenvio')} className="min-h-11 rounded-lg border border-amber-400/30 px-3 text-amber-200 disabled:opacity-40">Conferir reenvio da programação</button>
  </div>
  {ocupado&&<p role="status" className="mt-2">Aguarde…</p>}
  {previa&&<div className="mt-3 space-y-2">
   <p className="font-bold">{previa.modo==='reenvio'?'Prévia do reenvio':'Prévia dos novos avisos'} · {previa.total} aviso(s)</p>
   <p>{previa.jaRegistrados} já registrado(s) · {previa.semProgramacao} participação(ões) sem programação futura completa.</p>
   {previa.modo==='reenvio'&&previa.aguardando>0&&<p>{previa.aguardando} aviso(s) aguardando processamento; ficam fora deste reenvio.</p>}
   <p>{previa.destinatarios.avisosComAparelho} aviso(s) com aparelho cadastrado · {previa.destinatarios.avisosSemAparelho} sem aparelho cadastrado.</p>
   <p>{previa.destinatarios.contas} conta(s) com avisos cadastrados: {previa.destinatarios.atletas} de atletas e {previa.destinatarios.responsaveis} de responsáveis · {previa.destinatarios.aparelhos} aparelho(s). Uma conta pode ser atleta e responsável.</p>
   {previa.amostra.map((texto,n)=><p key={n} className="rounded-lg bg-black/40 p-2">{texto}</p>)}
   <p>Prévia de até oito avisos. O cadastro permite tentar o envio; a entrega depende da conexão e das permissões do aparelho.</p>
   {previa.bloqueadoAte&&<p role="status" className="text-amber-200">Aguarde cinco minutos entre reenvios. Depois, confira uma nova prévia.</p>}
   {previa.modo==='reenvio'&&previa.total>0&&<label className="flex min-h-11 cursor-pointer items-start gap-2 rounded-lg border border-amber-400/20 p-3 text-amber-100">
    <input type="checkbox" checked={confirmarReenvio} disabled={ocupado} onChange={e=>setConfirmarReenvio(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0"/>
    Quero reenviar estes avisos. Atletas e responsáveis que já receberam poderão receber novamente.
   </label>}
   <button type="button" disabled={ocupado||bloqueado||!previa.total||Boolean(previa.bloqueadoAte)||(previa.modo==='reenvio'&&!confirmarReenvio)} onClick={()=>void enviar()} className="min-h-11 rounded-lg bg-cyan-400 px-4 font-bold text-black disabled:opacity-40">Confirmar {previa.modo==='reenvio'?'reenvio':'envio'} de {previa.total} aviso(s)</button>
  </div>}
  {mensagem&&<p role="status" className="mt-3 text-cyan-200">{mensagem}</p>}
 </details>;
}

