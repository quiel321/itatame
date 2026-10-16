import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createECDH} from 'node:crypto';
import {resumoDestinatariosPush} from '../app/lib/push-destinatarios';
import {previaProgramacaoPush} from '../app/lib/push-programacao';
import {processarFilaPush} from '../app/lib/push-fila';

const assinatura=(id:string)=>({endpoint:`https://fcm.googleapis.com/fcm/send/${id}`,keys:{p256dh:Buffer.alloc(65,1).toString('base64url'),auth:Buffer.alloc(16,2).toString('base64url')}});
function banco(tabelas:Record<string,any[]>,aviso?:any){
 const alteracoes:{tabela:string;patch:any}[]=[];
 const db:any={rpc:async()=>({data:aviso?[aviso]:[],error:null}),from(tabela:string){
  const filtros:((x:any)=>boolean)[]=[];let patch:any,upsert=false;
  const dados=()=>((tabelas[tabela]||[]).filter(x=>filtros.every(f=>f(x))));
  const q:any={select(){return q;},eq(k:string,v:any){filtros.push(x=>x[k]===v);return q;},in(k:string,vs:any[]){filtros.push(x=>vs.includes(x[k]));return q;},range:async(a:number,b:number)=>({data:dados().slice(a,b+1),error:null}),single:async()=>({data:dados()[0],error:null}),update(p:any){patch=p;return q;},upsert(p:any){patch=p;upsert=true;return q;},then(resolve:any){
   if(patch){alteracoes.push({tabela,patch});if(upsert)(tabelas[tabela]??=[]).push(patch);return Promise.resolve(resolve({error:null}));}
   return Promise.resolve(resolve({data:dados(),error:null}));
  }};return q;
 }};return {db,alteracoes};
}

test('prévia conta responsável com vários dependentes, contas próprias e aparelhos sem duplicar',async()=>{
 const t={atletas:[{id:1,user_id:'pai'},{id:2,responsavel_id:'pai'},{id:3,user_id:'filho',responsavel_id:'pai'},{id:4,user_id:'sem'},{id:99,user_id:'outro'}],assinaturas_push:[{user_id:'pai',subscription:assinatura('pai')},{user_id:'outro',subscription:assinatura('outro')}],push_dispositivos:[{user_id:'pai',subscription:assinatura('pai')},{user_id:'filho',subscription:assinatura('filho')}]};
 const {db,alteracoes}=banco(t);
 assert.deepEqual(await resumoDestinatariosPush(db,[1,2,3,4].map(atleta_id=>({atleta_id}))),{atletas:2,responsaveis:1,contas:2,aparelhos:2,avisosComAparelho:3,avisosSemAparelho:1});
 assert.equal(alteracoes.length,0);
 assert.deepEqual(await resumoDestinatariosPush(db,[]),{atletas:0,responsaveis:0,contas:0,aparelhos:0,avisosComAparelho:0,avisosSemAparelho:0});
});

test('worker envia reenvio válido e descarta a intenção se o horário mudou',async()=>{
 const ec=createECDH('prime256v1');ec.generateKeys();process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY=ec.getPublicKey().toString('base64url');process.env.VAPID_PRIVATE_KEY=ec.getPrivateKey().toString('base64url');
 const horario=new Date(Date.now()+86400000).toISOString();
 const t:Record<string,any[]>={eventos:[{id:'evento',nome:'Teste',estado:'MT',status:'OFICIAL'}],inscricoes:[{evento_id:'evento',atleta_id:1,atleta:'Teste',categoria_id:'cat',pagamento_ok:true}],categorias_evento:[{evento_id:'evento',id:'cat',nome:'Teste',inicio_lutas_previsto:horario}],chaves:[{evento_id:'evento',categoria_id:'cat',atleta_1_id:1,tatame:'Tatame 1',horario_estimado:horario,status_luta:'agendada'}],chaves_publicacoes:[{evento_id:'evento',categoria_id:'cat',publicada:true}],staff_eventos:[{evento_id:'evento',funcao:'mesario',identificacao:'Tatame 1'}],atletas:[{id:1,responsavel_id:'pai'}],assinaturas_push:[{user_id:'pai',subscription:assinatura('pai')}],push_fila:[],push_entregas:[]};
 const original=(await previaProgramacaoPush(banco(t).db,'evento')).filas[0];
 t.push_fila.push({...original,estado:'enviado'});
 const reenvio=(await previaProgramacaoPush(banco(t).db,'evento','reenvio')).filas[0];
 const aviso={...reenvio,id:'novo-aviso',tentativas:1};
 const b=banco(t,aviso);let envios=0;
 const enviar:any=async(_s:any,p:string)=>{envios++;assert.equal(JSON.parse(p).tag,'itatame-novo-aviso');};
 await processarFilaPush(b.db,'evento',enviar);assert.equal(envios,1);assert.equal(b.alteracoes.at(-1)?.patch.estado,'enviado');
 t.categorias_evento[0].inicio_lutas_previsto=new Date(Date.now()+172800000).toISOString();
 const antigo=banco(t,aviso);await processarFilaPush(antigo.db,'evento',enviar);
 assert.equal(envios,1);assert.equal(antigo.alteracoes.at(-1)?.patch.estado,'expirado');
 assert.equal(t.push_fila[0].estado,'enviado');
});
