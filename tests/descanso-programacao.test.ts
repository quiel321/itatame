import test from 'node:test';
import assert from 'node:assert/strict';
import { montarChaves } from '../app/lib/gerar-chaves';
import { compararLutasDaCategoria } from '../app/lib/sequencia-tatames';
import { planejarHorariosCategorias, resumirProgramacao, type LutaProgramacao } from '../app/lib/programacao-categorias';
import { origensParaDescanso } from '../app/lib/descanso-programacao';
const inicio = '2026-10-17T18:00:00.000Z';
function chave(total: number, tempo = 3, categoria = 'TESTE'): LutaProgramacao[] {
 const p: Parameters<typeof montarChaves>[1] = {grupos:{G:Array.from({length:total},(_,i)=>({atleta_id:i+1,atleta:`FICTÍCIO ${i+1}`,equipe_atleta:'TESTE',equipe_chave:`EQUIPE ${i}`}))},metadados:{G:{categoria,categoria_id:categoria,faixa:'Branca',tempo_minutos:tempo}}};
 return montarChaves('FICTÍCIO',p).map((l,i)=>({...l,id:`${categoria}-${i}`} as LutaProgramacao)).sort(compararLutasDaCategoria).map((l,i)=>({...l,tatame:'AREA 1',ordem_tatame:i+1}));
}
test('estimativa incorpora somente o descanso que a transição não cobriu', () => {
 for (const [total,tempo,esperado] of [[2,3,3],[3,3,18],[4,3,17],[5,4,30],[6,3,27],[7,3,32],[13,6,104]]) {
  const lutas = chave(total,tempo), antes = structuredClone(lutas);
  const plano = planejarHorariosCategorias(lutas,inicio,2,[],{reservarDescanso:true,reservaFinal:10});
  assert.equal((Date.parse(plano.fim!)-Date.parse(inicio))/60000,esperado,`${total} atletas`);
  assert.equal((Date.parse(plano.fimComMargem!)-Date.parse(plano.fim!))/60000,10);
  assert.deepEqual(lutas,antes,'confrontos inalterados');
 }
});
test('margem entre categorias cobre a troca sem somar a transição duas vezes', () => {
 const a=chave(2), b=chave(2,3,'OUTRA').map((l,i)=>({...l,ordem_tatame:2+i,atleta_1_id:3,atleta_2_id:4}));
 const plano=planejarHorariosCategorias([...a,...b],inicio,2,[],{reservarDescanso:true,margemCategorias:5});
 assert.equal(plano.categorias[1].inicio,'2026-10-17T18:08:00.000Z');
 assert.equal(plano.categorias[1].descansoMinutos,0);
});
test('previsão não conta avanços estruturais como combates em chaves incompletas', () => {
 for (let total = 4; total <= 32; total++) {
  const plano = planejarHorariosCategorias(chave(total),inicio,2,[],{reservarDescanso:true});
  assert.equal(plano.updates.length,total-1,`${total} atletas`);
 }
});
test('chaves de seis não encaminham perdedores ao avanço sem adversário', () => {
 const lutas=chave(6), mapa=origensParaDescanso(lutas);
 const primeira=lutas.find(l=>String(l.id_visual)==='1')!, baia=lutas.find(l=>String(l.id_visual)==='2')!;
 for(const atleta of mapa.get(primeira.id)!)assert.ok(!mapa.get(baia.id)!.has(atleta));
 assert.equal(mapa.get(lutas.find(l=>String(l.id_visual)==='999')!.id)!.size,6);
});
test('descanso também considera possível participação em outra categoria', () => {
 const a=chave(2), b=chave(2,3,'OUTRA').map(l=>({...l,ordem_tatame:2}));
 const plano=planejarHorariosCategorias([...a,...b],inicio,2,[{categoria_id:'OUTRA',inicio_previsto:'2026-10-17T18:05:00Z'}],{reservarDescanso:true,margemCategorias:5});
 assert.equal(plano.categorias[1].inicio,'2026-10-17T18:09:00.000Z');
 assert.equal(plano.avisos[0].atrasoMinutos,4);
});
test('ciclos e margens inválidas falham sem gravar ou alterar a chave', () => {
 const lutas=chave(3);lutas[0].proxima_luta=lutas[0].id_visual;
 assert.throws(()=>planejarHorariosCategorias(lutas,inicio,2,[],{reservarDescanso:true}),/circulares/);
 assert.throws(()=>planejarHorariosCategorias([],inicio,2,[],{margemCategorias:-1}),/margens/);
});
test('horário automático da categoria permanece visível após a primeira luta concluída', () => {
 const lutas=chave(3), plano=planejarHorariosCategorias(lutas,inicio,2,[],{reservarDescanso:true});
 const salvas=lutas.map(l=>({...l,horario_estimado:plano.updates.find(u=>u.id===l.id)?.horario_estimado}));
 Object.assign(salvas[0],{status_luta:'concluida',vencedor:'FICTÍCIO'});
 const resumo=resumirProgramacao(salvas,[]);
 assert.equal(resumo[0].previsto,inicio);
 assert.notEqual(resumo[0].estimado,inicio);
});
