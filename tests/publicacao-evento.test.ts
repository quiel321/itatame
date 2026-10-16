import test from 'node:test';
import assert from 'node:assert/strict';
import { obterEtapaEvento, obterLinhaDoTempoEvento } from '../app/lib/evento-etapas';
import { consultarResumoPublicacoesChaves } from '../app/lib/publicacao-evento';
const evento={status:'ABERTO',estado:'MT',data_fim_inscricoes:'2026-10-13T23:59:00-04:00',data_fim_checagem:'2026-10-15T19:00:00-04:00',data_divulgacao_chaves:'2026-10-15T19:30:00-04:00',data_evento:'2026-10-17'};
const agora=new Date('2026-10-16T00:00:00Z');
test('horário previsto vencido nunca prova publicação, inclusive sem resposta de leitura',()=>{
 for(const resumo of [undefined,null,{total:0,publicadas:0},{total:12,publicadas:0}]){
 const e=obterEtapaEvento(evento,agora,null,resumo);assert.equal(e.codigo,'EM_CHAVEAMENTO');assert.equal(e.titulo,'Chaves em preparação');
 assert.equal(obterLinhaDoTempoEvento(evento,agora,resumo).find(m=>m.id==='chaves')!.estado,'futuro');
 }
});
test('publicação parcial e total seguem a decisão do organizador, mesmo antes do horário previsto',()=>{
 const cedo=new Date('2026-10-15T23:10:00Z');
 const parcial=obterEtapaEvento(evento,cedo,null,{total:12,publicadas:5});assert.equal(parcial.codigo,'CHAVES_PARCIAIS');assert.match(parcial.detalhe,/5 de 12/);
 const total=obterEtapaEvento(evento,cedo,null,{total:12,publicadas:12});assert.equal(total.codigo,'CHAVES_PUBLICADAS');assert.equal(total.titulo,'Todas as chaves publicadas');
 assert.equal(obterLinhaDoTempoEvento(evento,cedo,{total:12,publicadas:5}).find(m=>m.id==='chaves')!.estado,'atual');
 assert.equal(obterEtapaEvento(evento,agora,null,{total:12,publicadas:11}).codigo,'CHAVES_PARCIAIS','recolher uma categoria retira o aviso de todas publicadas');
});
test('inscrições, checagem, lutas ao vivo e encerramento mantêm suas regras',()=>{
 assert.equal(obterEtapaEvento(evento,new Date('2026-10-12T12:00:00Z'),null,{total:0,publicadas:0}).inscricoesAbertas,true);
 assert.equal(obterEtapaEvento({...evento,data_inicio_checagem:'2026-10-14'},new Date('2026-10-15T12:00:00Z'),null,{total:12,publicadas:0}).codigo,'CHECAGEM_ABERTA');
 assert.equal(obterEtapaEvento(evento,agora,{total:5,concluidas:1,emAndamento:1,pendentes:3},{total:12,publicadas:5}).codigo,'LUTAS_AO_VIVO');
 assert.equal(obterEtapaEvento({...evento,status:'ENCERRADO'},agora,null,{total:12,publicadas:5}).codigo,'ENCERRADO');
});
test('resumo usa apenas SELECT de metadados, inclui rascunhos e pagina sem expor confrontos',async()=>{
 const rows=Array.from({length:501},(_,i)=>({evento_id:i===500?'B':'A',categoria_id:String(i),publicada:i<5}));let paginas=0;
 const db={from:(t:string)=>{assert.equal(t,'chaves_publicacoes');return {select:(col:string)=>{assert.equal(col,'evento_id,categoria_id,publicada');return {in:()=>({order:()=>({range:async(a:number,b:number)=>{paginas++;return {data:rows.slice(a,b+1),error:null}}})})}}}}};
 assert.deepEqual(await consultarResumoPublicacoesChaves(db,['A','B','VAZIO']),{A:{total:500,publicadas:5},B:{total:1,publicadas:0},VAZIO:{total:0,publicadas:0}});assert.equal(paginas,2);
 assert.deepEqual(await consultarResumoPublicacoesChaves({from:()=>{throw Error('não consultar')}},[]),{});
});
test('falha de leitura não retorna total falso nem aproveita publicação antiga',async()=>{
 const db={from:()=>({select:()=>({in:()=>({order:()=>({range:async()=>({data:null,error:{message:'rede'}})})})})})};
 await assert.rejects(consultarResumoPublicacoesChaves(db,['A']),/conferir/);
});
