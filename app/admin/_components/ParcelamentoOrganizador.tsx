'use client';
import { useState } from 'react';
import { supabase } from '@/app/lib/supabase';
export default function ParcelamentoOrganizador({confirmado,inicialConectado}:{confirmado:boolean;inicialConectado:boolean}) {
  const [ativo,setAtivo]=useState(confirmado),[ocupado,setOcupado]=useState(false),[erro,setErro]=useState('');
  async function alterar(valor:boolean) {
    setOcupado(true);setErro('');
    try {const {data:{session}}=await supabase.auth.getSession();const r=await fetch('/api/organizador/parcelamento',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session?.access_token||''}`},body:JSON.stringify({confirmado:valor})});const d=await r.json();if(!r.ok)throw new Error(d.error);setAtivo(valor);}
    catch(e){setErro((e as Error).message);}finally{setOcupado(false);}
  }
  return <section className="mt-5 rounded-xl border border-white/10 p-4"><h3 className="text-sm font-bold">Parcelamento com acréscimos para o inscrito</h3><p className="text-xs text-zinc-400 mt-2">Na conta Mercado Pago conectada, desative a oferta de parcelas sem acréscimos para vendas online. As condições e os juros são apresentados pelo Mercado Pago antes do pagamento. A tarifa normal de processamento continua conforme sua conta.</p><label className="flex items-start gap-3 mt-3 text-xs"><input type="checkbox" checked={ativo} disabled={ocupado||!inicialConectado} onChange={e=>alterar(e.target.checked)}/><span>Confirmei essa configuração na conta conectada. Habilitar até 12 parcelas no checkout.</span></label><p className="text-xs text-zinc-500 mt-2">{ativo?'Parcelamento habilitado conforme as condições da conta.':'O cartão permanece em 1 parcela até a confirmação.'}</p>{erro&&<p role="alert" className="mt-2 text-xs text-red-400">{erro}</p>}</section>;
}
