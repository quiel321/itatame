import webpush from 'web-push';
import { destinosPush,assinaturasUnicas,hashPush,proximaTentativa } from './push-regras';
import { previaProgramacaoPush } from './push-programacao';
type DB=any;
export async function processarAvisosDisponiveis(db:DB,evento:string) {
 const limite=Date.now()+40000;let total=0;
 do {const r=await processarFilaPush(db,evento);total+=r.processados;if(!r.processados)break;}while(Date.now()<limite);
 return {processados:total};
}
export async function processarFilaPush(db:DB,evento:string,enviar:typeof webpush.sendNotification=webpush.sendNotification) {
 const pub=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,priv=process.env.VAPID_PRIVATE_KEY;
 if(!pub||!priv)return {processados:0,erro:'Configuração de push indisponível.'};
 webpush.setVapidDetails('mailto:suporte@itatame.com.br',pub,priv);
 const {data:eventoAtual,error:eventError}=await db.from('eventos').select('status').eq('id',evento).single();
 if(eventError||!eventoAtual||eventoAtual.status==='ENCERRADO')return {processados:0};
 const {data:avisos,error}=await db.rpc('push_reivindicar',{p_evento:evento,p_limite:5});if(error)throw Error('Não foi possível consultar os avisos pendentes.');
 let chavesAtuais:Set<string>|null=null;
 if((avisos||[]).some((a:any)=>a.tipo==='programacao'))chavesAtuais=new Set((await previaProgramacaoPush(db,evento)).chavesAtuais);
 const resultados=await Promise.all((avisos||[]).map(async(a:any)=>{
  try {
   const {data:inscricoes,error:ei}=await db.from('inscricoes').select('pagamento_ok,estorno_status').eq('evento_id',evento).eq('atleta_id',a.atleta_id);
   if(ei)throw Error('Inscrição indisponível.');
   if(!(inscricoes||[]).some((i:any)=>i.pagamento_ok&&i.estorno_status!=='estornado')){const r=await db.from('push_fila').update({estado:'expirado',finalizada_em:new Date().toISOString(),trava_ate:null}).eq('id',a.id);if(r.error)throw Error('Recibo indisponível.');return 'expirado';}
   if(a.tipo==='programacao'&&!chavesAtuais?.has(a.chave)){const r=await db.from('push_fila').update({estado:'expirado',finalizada_em:new Date().toISOString(),trava_ate:null}).eq('id',a.id);if(r.error)throw Error('Recibo indisponível.');return 'expirado';}
   // Avisos de chamada deixam de fazer sentido quando a luta terminou ou a categoria foi reaberta.
   if(a.luta_id){const {data:l,error:le}=await db.from('chaves').select('status_luta,categoria_id,iniciada_em,atleta_1_id,pontuacao_atleta_1,pontuacao_atleta_2').eq('id',a.luta_id).eq('evento_id',evento).single();if(le)throw Error('Consulta da luta indisponível.');
    const {data:c,error:ce}=await db.from('recepcao_categorias').select('fechada').eq('categoria_id',l.categoria_id).maybeSingle();if(ce)throw Error('Consulta da categoria indisponível.');
    const controle=l.atleta_1_id===a.atleta_id?l.pontuacao_atleta_1:l.pontuacao_atleta_2;
    const chamadaAntiga=a.tipo==='chamada'&&Number(controle?.chamador_chamadas||0)>Number.parseInt(a.titulo,10);
    const jaLiberada=['chamada','preparo'].includes(a.tipo)&&(Boolean(l.iniciada_em)||l.status_luta==='em_andamento');
    if(l.status_luta==='concluida'||!c?.fechada||chamadaAntiga||jaLiberada){const r=await db.from('push_fila').update({estado:'expirado',finalizada_em:new Date().toISOString(),trava_ate:null}).eq('id',a.id);if(r.error)throw Error('Recibo indisponível.');return 'expirado';}}
   if(a.tipo==='checkin'){const {data:i,error:ie}=await db.from('inscricoes').select('status_checkin').eq('evento_id',evento).eq('atleta_id',a.atleta_id).eq('pagamento_ok',true);if(ie)throw Error('Consulta da pesagem indisponível.');if(!(i||[]).some((x:any)=>x.status_checkin==='aprovado')){await db.from('push_fila').update({estado:'expirado',finalizada_em:new Date().toISOString()}).eq('id',a.id);return 'expirado';}}
   const {data:atleta,error:ae}=await db.from('atletas').select('user_id,responsavel_id').eq('id',a.atleta_id).single();if(ae)throw Error('Destinatário indisponível.');const destinos=destinosPush(atleta);
   const [{data:antigas,error:e1},{data:novas,error:e2},{data:recibos,error:e3}]=await Promise.all([
    db.from('assinaturas_push').select('subscription').in('user_id',destinos),db.from('push_dispositivos').select('subscription').in('user_id',destinos),db.from('push_entregas').select('endpoint_hash,estado').eq('aviso_id',a.id)]);
   if(e1||e2||e3)throw Error('Consulta dos aparelhos indisponível.');
   const assinaturas=assinaturasUnicas([...(antigas||[]),...(novas||[])]),anteriores=new Map((recibos||[]).map((r:any)=>[r.endpoint_hash,r.estado]));
   let enviadas=(recibos||[]).filter((r:any)=>r.estado==='enviado').length;let falhas=0;
   for(const assinatura of assinaturas){const hash=hashPush(assinatura.endpoint);if(anteriores.has(hash))continue;
    if(Date.now()>=new Date(a.expira_em).getTime())break;
    let estado='enviado';try{await enviar(assinatura,JSON.stringify({title:a.titulo,body:a.mensagem,icon:'/logo.svg',badge:'/logo.svg',url:a.url,tag:`itatame-${a.id}`}),{TTL:Math.max(1,Math.min(86400,Math.floor((new Date(a.expira_em).getTime()-Date.now())/1000))),timeout:5000,topic:hashPush(a.id).slice(0,32)});}
    catch(e){const status=Number((e as any)?.statusCode);if(status===404||status===410)estado='invalido';else{falhas++;continue;}}
    const {error:re}=await db.from('push_entregas').upsert({aviso_id:a.id,endpoint_hash:hash,estado},{onConflict:'aviso_id,endpoint_hash'});if(re)throw Error('Não foi possível confirmar o envio.');if(estado==='enviado')enviadas++;
   }
   const repetivel=falhas>0&&a.tentativas<6&&new Date(a.expira_em).getTime()>Date.now();
   const estado=repetivel?'pendente':falhas?'falha':enviadas?'enviado':Date.now()>=new Date(a.expira_em).getTime()?'expirado':'sem_assinatura';
   const {error:ue}=await db.from('push_fila').update({estado,enviados:enviadas,erro:falhas?'Um ou mais aparelhos não confirmaram o envio.':null,trava_ate:null,proxima_em:proximaTentativa(a.tentativas),finalizada_em:repetivel?null:new Date().toISOString()}).eq('id',a.id);if(ue)throw Error('Confirmação indisponível.');return estado;
  }catch {await db.from('push_fila').update({estado:a.tentativas<6?'pendente':'falha',erro:'Envio sem confirmação; consulte novamente.',trava_ate:null,proxima_em:proximaTentativa(a.tentativas)}).eq('id',a.id);return 'pendente';}
 }));return {processados:resultados.length};
}
