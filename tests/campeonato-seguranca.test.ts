import assert from 'node:assert/strict';
import test from 'node:test';
import { pagamentoEventoEncerrado } from '../app/lib/prazo-pagamento';
import { agendarChavesAutomaticas } from '../app/lib/agendar-chaves-automaticas';
import { gravarChavesEvento, chaveamentoAutomaticoLiberado } from '../app/lib/chaveamento-evento';
import { POST as publicarRanking } from '../app/api/organizador/ranking/route';

const id = '11111111-1111-4111-8111-111111111111';
test('prazo respeita o fuso do evento, mantém eventos sem prazo e bloqueia datas inválidas', () => {
  const evento = { estado: 'MT', data_fim_pagamento: '2026-10-13' };
  assert.equal(pagamentoEventoEncerrado(evento, new Date('2026-10-14T03:59:59Z')), false);
  assert.equal(pagamentoEventoEncerrado(evento, new Date('2026-10-14T04:00:00Z')), true);
  assert.equal(pagamentoEventoEncerrado({}), false);
  assert.equal(pagamentoEventoEncerrado({data_fim_pagamento: 'inválida'}), true);
});
test('automático aguarda o fim da checagem e a divulgação', () => {
  const evento = { id, organizador_id: id, data_fim_inscricoes: '2026-10-14T03:59:00Z', data_fim_checagem: '2026-10-14T23:00:00Z', data_divulgacao_chaves: '2026-10-14T23:30:00Z' };
  assert.equal(chaveamentoAutomaticoLiberado(evento, new Date('2026-10-14T23:00:00Z')), false);
  assert.equal(chaveamentoAutomaticoLiberado(evento, new Date('2026-10-14T23:30:00Z')), true);
});
test('página aberta antes do horário aguarda e gera sem clique; saída cancela o agendamento', async () => {
  let agora = 0, consultas = 0, conclusoes = 0, canceladas = 0;
  const timers: Array<{acao:()=>void; atraso:number}> = [];
  const ambiente = { agora:()=>agora, agendar:(acao:()=>void,atraso:number)=>{timers.push({acao,atraso});return timers.length as unknown as ReturnType<typeof setTimeout>;}, cancelar:()=>{canceladas++;}, consultar:async()=>{consultas++;return new Response('{}');} };
  const cancelar = agendarChavesAutomaticas(id, new Date(1000), ()=>{conclusoes++;}, ambiente);
  assert.equal(consultas, 0); assert.equal(timers[0].atraso, 1000);
  agora=1000; timers[0].acao(); await new Promise(resolve=>setImmediate(resolve));
  assert.equal(consultas, 1); assert.equal(conclusoes, 1); cancelar();
  const sair=agendarChavesAutomaticas(id,new Date(2000),()=>{},ambiente);sair();
  agora=2000;timers.at(-1)!.acao();assert.equal(consultas,1);assert.ok(canceladas>0);
});
test('falha temporária na geração é tentada novamente, com limite', async () => {
  const timers: Array<()=>void> = [];let consultas=0;
  agendarChavesAutomaticas(id,null,()=>{}, { agora:()=>0, agendar:(acao)=>{timers.push(acao);return timers.length as unknown as ReturnType<typeof setTimeout>;},cancelar:()=>{},consultar:async()=>{consultas++;return new Response('{}',{status:503});} });
  for(let i=0;i<5;i++){await new Promise(resolve=>setImmediate(resolve));timers.shift()?.();}
  assert.equal(consultas,4);assert.equal(timers.length,0);
});

async function simularApi(expirado: boolean, acao: (escritas: string[])=>Promise<void>) {
  const fetchAnterior=globalThis.fetch;
  const vars={NEXT_PUBLIC_SUPABASE_URL:'https://supabase.test',SUPABASE_SERVICE_ROLE_KEY:'ficticia',RESEND_API_KEY:'re_ficticia'};
  const anteriores=Object.fromEntries(Object.keys(vars).map(k=>[k,process.env[k]]));Object.assign(process.env,vars);
  const escritas: string[]=[];
  globalThis.fetch=async(input,init)=>{
    const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
    assert.equal(url.origin,'https://supabase.test','Nunca acessar dados ou pagamentos reais');
    const metodo=init?.method||'GET';
    if(metodo!=='GET')escritas.push(url.pathname);
    if(url.pathname==='/auth/v1/user')return Response.json({id,email:'teste@example.test',is_anonymous:false});
    if(url.pathname==='/rest/v1/inscricoes')return Response.json([{id:1,user_id:id,pagamento_ok:false,eventos:{id,organizador_id:id,estado:'MT',data_fim_pagamento:expirado?'2000-01-01T00:00:00Z':null}}]);
    if(url.pathname==='/rest/v1/eventos')return metodo==='PATCH'?new Response(null,{status:204}):Response.json([{id,organizador_id:id,regras_pontuacao_equipes:{ouro:9,prata:3,bronze:1}}]);
    if(url.pathname==='/rest/v1/chaves')return Response.json([{evento_id:id,status_luta:'concluida',fase:'Final',id_visual:'999',atleta_1:'Teste A',atleta_1_id:1,equipe_1:'A',atleta_2:'Teste B',atleta_2_id:2,equipe_2:'B',vencedor:'Teste A',vencedor_id:1,metodo_vitoria:'pontos'}]);
    throw new Error('Consulta inesperada: '+url.pathname);
  };
  try{await acao(escritas);}finally{globalThis.fetch=fetchAnterior;for(const[k,v]of Object.entries(anteriores)){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
}
test('publicar e republicar ranking não altera atletas, medalhas ou inscrições', async()=>{
  await simularApi(false,async escritas=>{
    for(let i=0;i<2;i++){
      const resposta=await publicarRanking(new Request('http://localhost/api/organizador/ranking',{method:'POST',headers:{Authorization:'Bearer ficticio'},body:JSON.stringify({eventoId:id})}));
      assert.equal(resposta.status,200);const dados=await resposta.json();assert.equal(dados.aplicados,0);assert.equal(dados.pontuaram,2);
    }
    assert.deepEqual(escritas,['/rest/v1/eventos','/rest/v1/eventos']);
  });
});
test('prazo vencido impede preparar e processar nova cobrança sem alterar pagamentos existentes', async()=>{
  await simularApi(true,async escritas=>{
    const rotas=[(await import('../app/api/pagamento/mercado-pago/preferencia/route')).POST,(await import('../app/api/pagamento/mercado-pago/processar/route')).POST];
    for(const rota of rotas){
      const resposta=await rota(new Request('http://localhost/api/pagamento',{method:'POST',headers:{Authorization:'Bearer ficticio'},body:JSON.stringify({inscricaoId:1,formData:{payment_method_id:'pix'}})}));
      assert.equal(resposta.status,409);assert.match((await resposta.json()).error,/prazo de pagamento/);
    }
    assert.deepEqual(escritas,[]);
  });
});
test('gravação usa RPC transacional e não faz DELETE/INSERT direto nem altera inscrições', async()=>{
  for(const automatico of [false,true]){
    let chamadas=0;
    const db={from:(tabela:string)=>{assert.equal(tabela,'chaves');return {select:()=>({eq:async()=>({data:[],error:null})})};},rpc:async(nome:string,args:Record<string,unknown>)=>{chamadas++;assert.equal(nome,automatico?'criar_chaves_evento_automaticas':'substituir_chaves_evento');assert.equal(args.p_evento,id);return {data:1,error:null};}};
    assert.equal(await gravarChavesEvento(db,{id,organizador_id:id},'peso',[{evento_id:id,categoria:'Peso'}],automatico),1);assert.equal(chamadas,1);
  }
});
test('falha de RPC preserva chaves sem fallback destrutivo e luta iniciada impede gravação', async()=>{
  let chamadas=0;
  const db={from:()=>({select:()=>({eq:async()=>({data:[],error:null})})}),rpc:async()=>{chamadas++;return {data:null,error:{message:'RPC indisponível'}};}};
  await assert.rejects(gravarChavesEvento(db,{id,organizador_id:id},'peso',[{evento_id:id}]),/segurança/);assert.equal(chamadas,1);
  const travado={...db,from:()=>({select:()=>({eq:async()=>({data:[{categoria:'Peso',status_luta:'em_andamento'}],error:null})})})};
  await assert.rejects(gravarChavesEvento(travado,{id,organizador_id:id},'peso',[{evento_id:id}]),/lutas iniciadas/);assert.equal(chamadas,1);
});
