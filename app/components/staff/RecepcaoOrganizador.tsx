'use client';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/app/lib/supabase';
export default function RecepcaoOrganizador({ eventoId }: { eventoId: string }) {
 const [fechadas,setFechadas]=useState<{categoria_id:string;nome:string}[]>([]);
 const [aviso,setAviso]=useState('');const [loading,setLoading]=useState(false);
 const carregar=useCallback(async()=>{
  const [controles,categorias]=await Promise.all([
   supabase.from('recepcao_categorias').select('categoria_id').eq('evento_id',eventoId).eq('fechada',true),
   supabase.from('categorias_evento').select('id,nome').eq('evento_id',eventoId),
  ]);
  if(controles.error||categorias.error){setFechadas([]);return;}
  setFechadas((controles.data||[]).map(c=>({categoria_id:c.categoria_id,nome:categorias.data?.find(n=>n.id===c.categoria_id)?.nome||'Categoria'})));
 },[eventoId]);
 useEffect(()=>{void carregar();},[carregar]);
 async function reabrir(categoria:string){
  if(loading||!window.confirm('Reabrir a recepção desta categoria? Os avanços automáticos serão desfeitos. Só é permitido antes do despacho aos combates.'))return;
  setLoading(true);setAviso('');
  try{
   const {error}=await supabase.rpc('recepcao_operar',{p_categoria:categoria,p_acao:'reabrir',p_inscricao:null});
   if(error)throw new Error(error.message);
   setAviso('Categoria reaberta. Revise a recepção e feche novamente para despachar.');await carregar();
  }catch(e){setAviso(e instanceof Error?e.message:'Não foi possível reabrir.');}finally{setLoading(false);}
 }
 return <section className="mb-6 rounded-xl border border-cyan-500/20 bg-cyan-950/10 p-4">
  <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-bold text-cyan-200">Check-in das categorias</h3><button onClick={()=>void carregar()} className="min-h-11 rounded-lg border border-white/10 px-3 text-xs text-zinc-300">Atualizar categorias</button></div>
  <p className="mt-1 text-xs text-zinc-400">A equipe fecha e despacha pela Recepção / Pesagem. A organização pode reabrir antes de presença na baia, chamada ou combate realizado.</p>
  {aviso&&<p role="status" className="mt-3 rounded-lg bg-black/30 p-3 text-xs text-cyan-100">{aviso}</p>}
  {fechadas.length===0?<p className="mt-3 text-xs text-zinc-500">Nenhuma categoria fechada nesta seleção.</p>:<div className="mt-3 space-y-2">{fechadas.map(c=><div key={c.categoria_id} className="flex items-center justify-between gap-3 rounded-lg bg-black/30 p-3"><span className="text-xs text-white">{c.nome} · Fechada</span><button disabled={loading} onClick={()=>void reabrir(c.categoria_id)} className="min-h-11 shrink-0 rounded-lg border border-cyan-500/30 px-3 text-xs text-cyan-200 disabled:opacity-40">Reabrir check-in</button></div>)}</div>}
 </section>;
}

