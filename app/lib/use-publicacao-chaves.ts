"use client";
import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { consultarResumoPublicacoesChaves } from './publicacao-evento';
import type { ResumoPublicacaoChaves } from './evento-etapas';
export function usePublicacaoChaves(ids: string[]) {
 const chave=[...new Set(ids.filter(Boolean))].sort().join(',');
 const [resumos,setResumos]=useState<Record<string,ResumoPublicacaoChaves|null>>({});
 useEffect(()=>{
  let ativo=true,versao=0;const eventos=chave?chave.split(','):[];setResumos({});
  if(!eventos.length)return;
  const atualizar=async()=>{const atual=++versao;try{const data=await consultarResumoPublicacoesChaves(supabase,eventos);if(ativo&&atual===versao)setResumos(data);}catch{if(ativo&&atual===versao)setResumos({});}};
  void atualizar();
  const canal=supabase.channel('publicacao-status-'+chave).on('postgres_changes',{event:'*',schema:'public',table:'chaves_publicacoes'},()=>void atualizar()).subscribe();
  const intervalo=window.setInterval(()=>void atualizar(),20000);
  return ()=>{ativo=false;window.clearInterval(intervalo);void supabase.removeChannel(canal);};
 },[chave]);
 return resumos;
}
