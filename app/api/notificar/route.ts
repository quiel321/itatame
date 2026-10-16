import { after,NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/app/lib/supabase-server';
import { processarAvisosDisponiveis } from '@/app/lib/push-fila';
import { categoriasPushDaInscricao,previaProgramacaoPush,todasLinhas } from '@/app/lib/push-programacao';
import { hashPush } from '@/app/lib/push-regras';
import { resumoDestinatariosPush } from '@/app/lib/push-destinatarios';
export const runtime='nodejs';
export const maxDuration=60;
export async function POST(request:Request) {
 try {
  const token=request.headers.get('authorization')?.replace(/^Bearer /i,'');if(!token)return NextResponse.json({error:'Sessão ausente.'},{status:401});
  const raw=await request.text();if(raw.length>3000)return NextResponse.json({error:'Pedido inválido.'},{status:400});const body=JSON.parse(raw);
  const ev=String(body.evento_id||'');if(!/^[a-f0-9-]{36}$/i.test(ev))return NextResponse.json({error:'Evento inválido.'},{status:400});
  const db=createSupabaseServerClient();const {data:auth,error:ae}=await db.auth.getUser(token);if(ae||!auth.user)return NextResponse.json({error:'Sessão inválida.'},{status:401});
  const {data:e,error:ee}=await db.from('eventos').select('id,organizador_id,status').eq('id',ev).maybeSingle();if(ee)throw Error('Consulta indisponível.');const dono=e?.organizador_id===auth.user.id&&!auth.user.is_anonymous;
  const {data:posto,error:pe}=await db.from('staff_sessoes').select('staff_evento_id,funcao,expira_em').eq('auth_user_id',auth.user.id).eq('evento_id',ev).gt('expira_em',new Date().toISOString()).maybeSingle();if(pe)throw Error('Consulta do posto indisponível.');
  if(!e||(!dono&&!posto))return NextResponse.json({error:'Evento não autorizado.'},{status:403});
  if(body.acao==='previa_programacao'||body.acao==='programacao'){
   if(!dono)return NextResponse.json({error:'Somente o organizador pode divulgar a programação.'},{status:403});
   if(body.modo!==undefined&&!['novos','reenvio'].includes(body.modo))return NextResponse.json({error:'Opção de envio inválida.'},{status:400});
   const modo=body.modo==='reenvio'?'reenvio':'novos';
   const p=await previaProgramacaoPush(db,ev,modo);const {filas,chavesAtuais,...publica}=p;
   if(body.acao==='previa_programacao')return NextResponse.json({success:true,...publica,destinatarios:await resumoDestinatariosPush(db,filas)});
   if(body.confirmado!==true||body.versao!==p.versao)return NextResponse.json({error:'A programação mudou ou não foi confirmada. Confira a prévia novamente.'},{status:409});
   if(modo==='reenvio'&&body.confirmar_reenvio!==true)return NextResponse.json({error:'Confirme que deseja repetir os avisos já registrados.'},{status:409});
   if(p.bloqueadoAte)return NextResponse.json({error:'Aguarde cinco minutos entre reenvios e confira uma nova prévia.'},{status:429});
   // Cada reenvio confirmado acrescenta um lote; os registros antigos são preservados.
   if(filas.length){const {error}=await db.from('push_fila').upsert(filas,{onConflict:'chave',ignoreDuplicates:true});if(error)throw Error('Não foi possível guardar os avisos.');}
   after(async()=>{await processarAvisosDisponiveis(db,ev).catch(()=>{});});return NextResponse.json({success:true,registrados:filas.length,...publica});
  }
  if(e.status==='ENCERRADO')return NextResponse.json({success:true,processados:0});
  if(body.acao==='preparar'){
   if(!dono&&!['chamador','mesario','operacao'].includes(posto?.funcao||''))return NextResponse.json({error:'Posto não autorizado.'},{status:403});
   if(![5,15].includes(body.marco))return NextResponse.json({error:'Etapa inválida.'},{status:400});
   const {data:l,error:le}=await db.from('chaves').select('*').eq('id',body.luta_id).eq('evento_id',ev).single();if(le)throw Error('Luta indisponível.');
   const {data:c,error:ce}=await db.from('recepcao_categorias').select('fechada').eq('categoria_id',l.categoria_id).maybeSingle();if(ce)throw Error('Categoria indisponível.');
   const diferenca=(Date.parse(l.horario_estimado)-Date.now())/60000;
   if(!c?.fechada||l.status_luta!=='agendada'||l.iniciada_em||!l.tatame||!Number.isFinite(diferenca)||diferenca<0||diferenca>body.marco)return NextResponse.json({success:true,registrados:0});
   const {data:candidatas,error:ie}=await db.from('inscricoes').select('atleta_id,atleta,status_checkin,pagamento_ok,pesagem_ok,kimono_aprovado,estorno_status,categoria_id,categoria,faixa,sexo,idade,peso,modalidade,absoluto').eq('evento_id',ev).in('atleta_id',[l.atleta_1_id,l.atleta_2_id].filter(Boolean));if(ie)throw Error('Pesagem indisponível.');
   const categorias=await todasLinhas(db,'categorias_evento','*',ev);
   const ins=(candidatas||[]).filter(i=>categoriasPushDaInscricao(i,categorias).includes(l.categoria_id));
   if((ins||[]).filter(i=>i.status_checkin==='aprovado'&&i.pagamento_ok&&i.pesagem_ok&&i.kimono_aprovado&&i.estorno_status!=='estornado').length!==2)return NextResponse.json({success:true,registrados:0});
   const itens=ins!.map(i=>({evento_id:ev,atleta_id:i.atleta_id,luta_id:l.id,chave:'preparo:'+hashPush(JSON.stringify([ev,l.id,i.atleta_id,body.marco,l.horario_estimado])),tipo:'preparo',titulo:body.marco===5?'Sua luta está próxima':'Prepare-se para sua luta',mensagem:`${i.atleta}: sua luta está prevista para os próximos ${body.marco} minutos no ${l.tatame}. É uma estimativa; acompanhe a chamada.`,url:`/evento/${ev}/ao-vivo`,expira_em:new Date(Math.min(Date.parse(l.horario_estimado)+5*60000,Date.now()+body.marco*60000)).toISOString()}));
   const {error}=await db.from('push_fila').upsert(itens,{onConflict:'chave',ignoreDuplicates:true});if(error)throw Error('Não foi possível proteger os avisos.');
  }else if(body.acao!=='processar')return NextResponse.json({error:'Ação inválida.'},{status:400});
  after(async()=>{await processarAvisosDisponiveis(db,ev).catch(()=>{});});return NextResponse.json({success:true,aceito:true});
 }catch {return NextResponse.json({error:'Não foi possível confirmar os avisos agora. As pendências salvas continuam protegidas.'},{status:503});}
}
