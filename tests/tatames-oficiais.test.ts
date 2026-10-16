import test from 'node:test';
import assert from 'node:assert/strict';
import { tatameOficial, tatamesOficiais } from '../app/lib/tatames-oficiais';
import { montarChaves } from '../app/lib/gerar-chaves';
import { categoriasComTatamesProntos } from '../app/lib/planejamento-operacao';

test('somente postos cadastrados compõem as opções; valor herdado não vira área oficial', () => {
 const oficiais = tatamesOficiais(['AREA 2', 'AREA 1', ' area 1 ', null, '']);
 assert.deepEqual(oficiais, ['AREA 1', 'AREA 2']);
 assert.equal(tatameOficial('Tatame 1', oficiais), null);
 assert.equal(tatameOficial('Não definido', oficiais), null);
 assert.equal(tatameOficial(' área 1 ', oficiais), 'AREA 1');
 assert.deepEqual(tatamesOficiais([]), []);
});
test('todas as novas lutas começam sem tatame, sequência ou horário, em todos os formatos', () => {
 for (const total of [2,3,4,5,6,7,13]) {
  const preparados: Parameters<typeof montarChaves>[1] = {grupos:{G:Array.from({length:total},(_,i)=>({atleta_id:i+1,atleta:`FICTÍCIO ${i+1}`,equipe_atleta:'TESTE',equipe_chave:`EQUIPE ${i}`}))},metadados:{G:{categoria:'G',categoria_id:'categoria',faixa:'Branca',tempo_minutos:3}}};
  const lutas=montarChaves('ensaio',preparados);
  assert.ok(lutas.length);
  assert.ok(lutas.every(l=>l.tatame===null && l.ordem_tatame===null && l.horario_estimado===null));
  assert.deepEqual(categoriasComTatamesProntos(lutas as {categoria_id:string}[], [{identificacao:'AREA 1'}]),[]);
 }
});
