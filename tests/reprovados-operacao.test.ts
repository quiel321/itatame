import test from 'node:test';
import assert from 'node:assert/strict';
import { processarAvancosAutomaticosChaves } from '../app/lib/chaves-auto-avanco';
import { situacaoAtletaLuta, lutaComAtletaImpedido } from '../app/lib/situacao-atleta-luta';
import { resultadoOperacional } from '../app/lib/operacao-campeonato';

test('reprovação e ausência retiram o confronto da operação; não confundem o vencedor presente',()=>{
 assert.equal(lutaComAtletaImpedido({checkin_1:'desclassificado_peso',checkin_2:'aprovado'}),true);
 assert.equal(situacaoAtletaLuta({checkin_1:'desclassificado_kimono'},1),'Desclassificado · kimono/faixa');
 const l={status_luta:'concluida',atleta_1_id:1,atleta_2_id:2,vencedor_id:2,pontuacao_atleta_1:{recepcao_wo:true},pontuacao_atleta_2:{recepcao_wo:true}};
 assert.equal(situacaoAtletaLuta(l,2),'');assert.equal(situacaoAtletaLuta(l,1),'Ausente / desclassificado');
});
test('avanços por ausência e reprovação não contam como combates realizados',()=>{
 const l={status_luta:'concluida',metodo_vitoria:'wo',atleta_1:'A',atleta_2:'B',pontuacao_atleta_1:{recepcao_wo:true}};
 assert.equal(resultadoOperacional({...l,vencedor:'A'}),'bye');
 assert.equal(resultadoOperacional({...l,vencedor:'BYE'}),'vazio');
});
for (const definitivo of [false,true]) test(`não reabre avanço de reprovado, decisão definitiva=${definitivo}`, async()=>{
 const luta={id:'l1',evento_id:'ev',categoria_id:'cat',categoria:'Teste',faixa:'Branca',tatame:'AREA 1',atleta_1:'ATLETA REPROVADO',atleta_1_id:1,atleta_2:'BYE',status_luta:'concluida',vencedor:'BYE',metodo_vitoria:'wo',pontuacao_atleta_1:definitivo?{recepcao_wo:true}:{}};
 const escritas:unknown[]=[];
 const db={from(tabela:string){let payload:unknown;const q:any={select(){return q;},eq(){return q;},in(){return q;},update(v:unknown){payload=v;return q;},then(resolve:any,reject:any){if(payload)escritas.push(payload);return Promise.resolve({error:null,data:tabela==='recepcao_categorias'?[{categoria_id:'cat'}]:tabela==='chaves'?[luta]:[{categoria_id:'cat',atleta_id:1,status_checkin:'desclassificado_peso'}]}).then(resolve,reject);}};return q;},async rpc(){return {error:null};}};
 await processarAvancosAutomaticosChaves(db,'ev','cat');assert.deepEqual(escritas,[]);
});
