import assert from 'node:assert/strict';
import { GET, POST } from '../app/api/eventos/[id]/mensagens/route';
process.env.NEXT_PUBLIC_SUPABASE_URL='https://database.test';
process.env.SUPABASE_SERVICE_ROLE_KEY='test-service-key';
const visitante='11111111-1111-4111-8111-111111111111', organizador='22222222-2222-4222-8222-222222222222';
let usuario=visitante, conversaExiste=true;
const mensagens:any[]=[];
const chamadas:string[]=[];
globalThis.fetch=async(input:any,init:any={})=>{
 const url=new URL(String(input)); chamadas.push(url.pathname+url.search);
 if(url.hostname!=='database.test')throw new Error('Rede externa bloqueada neste teste');
 const headers=new Headers(init.headers);
 if(url.pathname==='/auth/v1/user')return Response.json({id:usuario,email:'teste@example.com',user_metadata:{},app_metadata:{},aud:'authenticated'});
 const tabela=url.pathname.split('/').pop();
 if(tabela==='eventos')return Response.json({id:'evento-teste',nome:'Campeonato teste',organizador_id:organizador});
 if(tabela==='inscricoes')return Response.json([]);
 if(tabela==='atletas_publico')return Response.json([]);
 if(tabela==='mensagens_evento'){
  if(init.method==='POST'){const body=JSON.parse(init.body);mensagens.push(body);return Response.json({id:'mensagem-teste',...body});}
  if(init.method==='PATCH')return new Response(null,{status:204});
  if(headers.get('prefer')?.includes('count=exact'))return new Response(null,{headers:{'content-range':'0-0/1'}});
  if(url.searchParams.get('remetente')==='eq.atleta')return Response.json(conversaExiste?[{id:'mensagem-anterior'}]:[]);
  return Response.json(mensagens.map((m,i)=>({id:String(i),...m,criado_em:new Date().toISOString()})));
 }
 throw new Error('Consulta inesperada: '+url);
};
const ctx={params:Promise.resolve({id:'evento-teste'})};
function request(method:string,body?:object){return new Request('https://itatame.test/api/eventos/evento-teste/mensagens?atleta=outro-usuario',{method,headers:{Authorization:'Bearer test','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});}
(async()=>{
 assert.equal((await POST(new Request('https://itatame.test/api',{method:'POST'}),ctx)).status,401);
 assert.equal((await POST(request('POST',{texto:'Posso participar?',atletaUserId:'outro-usuario'}),ctx)).status,200);
 assert.equal(mensagens[0].atleta_user_id,visitante);assert.equal(mensagens[0].remetente,'atleta');
 chamadas.length=0;assert.equal((await GET(request('GET'),ctx)).status,200);
 assert.ok(chamadas.some(u=>u.includes('atleta_user_id=eq.'+visitante)));assert.ok(!chamadas.some(u=>u.includes('atleta_user_id=eq.outro-usuario')));
 usuario=organizador;assert.equal((await POST(request('POST',{texto:'Sim, pode.',atletaUserId:visitante}),ctx)).status,200);
 conversaExiste=false;assert.equal((await POST(request('POST',{texto:'Mensagem',atletaUserId:'desconhecido'}),ctx)).status,400);
 assert.equal(mensagens.length,2);console.log('PASS: visitante sem inscrição, privacidade da conversa, resposta do organizador e bloqueio de destinatário sem vínculo');
})();
