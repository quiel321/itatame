import {test} from 'node:test';import assert from 'node:assert/strict';import {previaProgramacaoPush,categoriasPushDaInscricao,chaveOriginalProgramacao} from '../app/lib/push-programacao';
const horario=new Date(Date.now()+86400000).toISOString();
function dbTeste({publicada=true,salva=true,existente='',estado='enviado',historico=[] as any[]}={}){const t:any={inscricoes:[{id:1,atleta:'Atleta fictício',atleta_id:10,categoria_id:'cat',pagamento_ok:true}],categorias_evento:[{id:'cat',nome:'Infantil',faixa:'Branca',inicio_lutas_previsto:horario}],chaves:[{id:'luta',categoria_id:'cat',atleta_1_id:10,atleta_2_id:11,tatame:salva?'Tatame 1':null,horario_estimado:horario,status_luta:'agendada'}],chaves_publicacoes:[{categoria_id:'cat',publicada}],staff_eventos:[{funcao:'mesario',identificacao:'Tatame 1'}],push_fila:[...(existente?[{chave:existente,estado}]:[]),...historico]};return {from(nome:string){const q:any={select(){return q},eq(){return q},single:async()=>({data:{id:'evento',nome:'Teste',estado:'MT',status:'OFICIAL'},error:null}),range:async()=>({data:t[nome]||[],error:null})};return q;}};}
test('prévia usa somente dados salvos e publicados e não modifica tabelas',async()=>{const p=await previaProgramacaoPush(dbTeste(),'evento');assert.equal(p.total,1);assert.match(p.amostra[0],/Atleta fictício.*Infantil.*Tatame 1/);assert.equal((await previaProgramacaoPush(dbTeste({publicada:false}),'evento')).total,0);assert.equal((await previaProgramacaoPush(dbTeste({salva:false}),'evento')).total,0);});
test('mesma programação não gera segundo aviso e a versão da prévia é estável',async()=>{const p=await previaProgramacaoPush(dbTeste(),'evento'),q=await previaProgramacaoPush(dbTeste({existente:p.filas[0].chave}),'evento');assert.equal(q.total,0);assert.equal(q.jaRegistrados,1);assert.equal(q.versao,p.versao);});
test('reenvio preserva o aviso original e gera lote estável distinto do envio normal',async()=>{
 const original=(await previaProgramacaoPush(dbTeste(),'evento')).filas[0];
 const db=dbTeste({existente:original.chave});
 const a=await previaProgramacaoPush(db,'evento','reenvio'),b=await previaProgramacaoPush(db,'evento','reenvio');
 assert.equal(a.total,1);assert.equal(a.versao,b.versao);assert.equal(a.filas[0].chave,b.filas[0].chave);
 assert.notEqual(a.filas[0].chave,original.chave);assert.equal(chaveOriginalProgramacao(a.filas[0].chave),original.chave);
 assert.equal(a.filas[0].mensagem,original.mensagem);assert.equal(a.filas[0].tipo,'programacao');
 const depois=await previaProgramacaoPush(dbTeste({existente:original.chave,historico:[{...a.filas[0],estado:'enviado',criada_em:new Date().toISOString()}]}),'evento','reenvio');
 assert.notEqual(depois.versao,a.versao);assert.notEqual(depois.filas[0].chave,a.filas[0].chave);assert.ok(depois.bloqueadoAte);
});
test('reenvio ignora avisos novos, pendentes e horários sem publicação',async()=>{
 assert.equal((await previaProgramacaoPush(dbTeste(),'evento','reenvio')).total,0);
 const chave=(await previaProgramacaoPush(dbTeste(),'evento')).filas[0].chave;
 const pronta=await previaProgramacaoPush(dbTeste({existente:chave}),'evento','reenvio');
 for(const estado of ['pendente','processando']){
  const p=await previaProgramacaoPush(dbTeste({existente:chave,estado}),'evento','reenvio');
  assert.equal(p.total,0);assert.equal(p.aguardando,1);assert.notEqual(p.versao,pronta.versao);
 }
 assert.equal((await previaProgramacaoPush(dbTeste({existente:chave,publicada:false}),'evento','reenvio')).total,0);
 const pendente=await previaProgramacaoPush(dbTeste({existente:chave,historico:[{...pronta.filas[0],estado:'pendente'}]}),'evento','reenvio');
 assert.equal(pendente.total,0);assert.equal(pendente.aguardando,1);
 const antiga=await previaProgramacaoPush(dbTeste({existente:chave,historico:[{...pronta.filas[0],estado:'enviado',criada_em:new Date(Date.now()-301000).toISOString()}]}),'evento','reenvio');
 assert.equal(antiga.bloqueadoAte,null);
});
test('absoluto sem categoria_id segue o enquadramento oficial e pode coexistir com peso',()=>{
 const cat:any={id:'abs',nome:'Absoluto GP',tipo:'absoluto',ativa:true,modalidade:'Jiu-Jitsu',sexo:'Masculino',faixa:'Branca · Azul',idade_min:16,idade_max:100,peso_min:0,peso_max:null};
 const i:any={atleta_id:10,categoria:'Absoluto',absoluto:true,faixa:'Azul',sexo:'Masculino',idade:20,peso:80,modalidade:'Jiu-Jitsu'};
 assert.deepEqual(categoriasPushDaInscricao(i,[cat]),['abs']);
 assert.deepEqual(categoriasPushDaInscricao({...i,categoria_id:'peso'},[cat]),['peso','abs']);
 assert.deepEqual(categoriasPushDaInscricao({...i,sexo:'Feminino'},[cat]),[]);
 assert.deepEqual(categoriasPushDaInscricao({...i,absoluto:false},[cat]),[]);
});
