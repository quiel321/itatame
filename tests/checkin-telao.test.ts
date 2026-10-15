import test from 'node:test';
import assert from 'node:assert/strict';
import { resumoCheckinTelao } from '../app/lib/checkin-telao';
test('telão não conta ausência como check-in pendente e identifica atletas por ID',()=>{
 const itens=[{id:1,atleta_id:10,categoria_id:'a',atleta:'Mesmo nome',status_checkin:'pendente'}, {id:2,atleta_id:20,categoria_id:'a',atleta:'Mesmo nome',status_checkin:'aprovado',checkin_realizado_em:'2026-10-15T10:00:00Z'}, {id:3,atleta_id:20,categoria_id:'b',atleta:'Mesmo nome',status_checkin:'aprovado',checkin_realizado_em:'2026-10-15T10:01:00Z'}, {id:4,atleta_id:30,categoria_id:'a',atleta:'Reprovado',status_checkin:'desclassificado_peso'}];
 assert.deepEqual(resumoCheckinTelao(itens,new Set(['a:10'])),{aprovados:1,aguardando:0,recentes:['Mesmo nome']});
 assert.equal(resumoCheckinTelao(itens,new Set()).aguardando,1);
});
