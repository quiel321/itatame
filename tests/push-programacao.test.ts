import {test} from 'node:test';import assert from 'node:assert/strict';import {previaProgramacaoPush,categoriasPushDaInscricao} from '../app/lib/push-programacao';
const horario=new Date(Date.now()+86400000).toISOString();
function dbTeste({publicada=true,salva=true,existente=''}={}){const t:any={inscricoes:[{id:1,atleta:'Atleta fictício',atleta_id:10,categoria_id:'cat',pagamento_ok:true}],categorias_evento:[{id:'cat',nome:'Infantil',faixa:'Branca',inicio_lutas_previsto:horario}],chaves:[{id:'luta',categoria_id:'cat',atleta_1_id:10,atleta_2_id:11,tatame:salva?'Tatame 1':null,horario_estimado:horario,status_luta:'agendada'}],chaves_publicacoes:[{categoria_id:'cat',publicada}],staff_eventos:[{funcao:'mesario',identificacao:'Tatame 1'}],push_fila:existente?[{chave:existente,estado:'enviado'}]:[]};return {from(nome:string){const q:any={select(){return q},eq(){return q},single:async()=>({data:{id:'evento',nome:'Teste',estado:'MT',status:'OFICIAL'},error:null}),range:async()=>({data:t[nome]||[],error:null})};return q;}};}
test('prévia usa somente dados salvos e publicados e não modifica tabelas',async()=>{const p=await previaProgramacaoPush(dbTeste(),'evento');assert.equal(p.total,1);assert.match(p.amostra[0],/Atleta fictício.*Infantil.*Tatame 1/);assert.equal((await previaProgramacaoPush(dbTeste({publicada:false}),'evento')).total,0);assert.equal((await previaProgramacaoPush(dbTeste({salva:false}),'evento')).total,0);});
test('mesma programação não gera segundo aviso e a versão da prévia é estável',async()=>{const p=await previaProgramacaoPush(dbTeste(),'evento'),q=await previaProgramacaoPush(dbTeste({existente:p.filas[0].chave}),'evento');assert.equal(q.total,0);assert.equal(q.jaRegistrados,1);assert.equal(q.versao,p.versao);});
test('absoluto sem categoria_id segue o enquadramento oficial e pode coexistir com peso',()=>{
 const cat:any={id:'abs',nome:'Absoluto GP',tipo:'absoluto',ativa:true,modalidade:'Jiu-Jitsu',sexo:'Masculino',faixa:'Branca · Azul',idade_min:16,idade_max:100,peso_min:0,peso_max:null};
 const i:any={atleta_id:10,categoria:'Absoluto',absoluto:true,faixa:'Azul',sexo:'Masculino',idade:20,peso:80,modalidade:'Jiu-Jitsu'};
 assert.deepEqual(categoriasPushDaInscricao(i,[cat]),['abs']);
 assert.deepEqual(categoriasPushDaInscricao({...i,categoria_id:'peso'},[cat]),['peso','abs']);
 assert.deepEqual(categoriasPushDaInscricao({...i,sexo:'Feminino'},[cat]),[]);
 assert.deepEqual(categoriasPushDaInscricao({...i,absoluto:false},[cat]),[]);
});
