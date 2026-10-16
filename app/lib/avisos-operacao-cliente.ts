import { supabase } from './supabase';
import { lerSessaoStaff } from './staff-sessao';
export async function solicitarAvisos(evento:string,dados:Record<string,unknown>) {
 const {data}=await supabase.auth.getSession();if(!data.session?.access_token)throw Error('Entre novamente para conferir os avisos.');
 const response=await fetch('/api/notificar',{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${data.session.access_token}`},body:JSON.stringify({evento_id:evento,...dados}),signal:AbortSignal.timeout(12000)});
 const r=await response.json();if(!response.ok||!r.success)throw Error(r.error||'Avisos sem confirmação.');return r;
}
let ultimo=0,ocupado=false;
export async function processarAvisosPendentes(evento?:string,forcar=false) {
 const id=evento||lerSessaoStaff()?.evento_id;if(!id||ocupado||(!forcar&&Date.now()-ultimo<30000)||!navigator.onLine)return;
 ocupado=true;ultimo=Date.now();try {await solicitarAvisos(String(id),{acao:'processar'});}finally{ocupado=false;}
}
