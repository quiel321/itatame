import test from 'node:test';
import assert from 'node:assert/strict';
import { montarChaves } from '../app/lib/gerar-chaves';
import { combatesPrevistos, nomeOrigemPrevista, type LutaPrevista } from '../app/lib/combates-previstos';

test('eliminatórias mostram n-1 combates, mantendo final futura e entradas intactas', () => {
  for (const n of [2, ...Array.from({length:61}, (_, i) => i + 4)]) {
    const lutas = montarChaves('TESTE', { grupos: {G:Array.from({length:n},(_,i)=>({atleta_id:i+1,atleta:`FICTÍCIO ${i+1}`,equipe_atleta:'TESTE',equipe_chave:`EQUIPE ${i}`}))}, metadados:{G:{categoria:'TESTE',categoria_id:'TESTE',faixa:'Branca',tempo_minutos:3}} });
    const antes = structuredClone(lutas), modelo = combatesPrevistos(lutas as unknown as LutaPrevista[])!;
    assert.equal(modelo.lutas.length, n - 1, `${n} atletas`);
    assert.ok(modelo.final); assert.deepEqual(lutas, antes);
  }
});

const cinco = [
  {id_visual:'1',proxima_luta:101,fase:'Quartas',ordem:1,atleta_1:'A',atleta_2:'B'},
  {id_visual:'2',proxima_luta:101,fase:'Quartas',ordem:2,atleta_1:'BYE',atleta_2:'BYE'},
  {id_visual:'3',proxima_luta:102,fase:'Quartas',ordem:3,atleta_1:'C',atleta_2:'D'},
  {id_visual:'4',proxima_luta:102,fase:'Quartas',ordem:4,atleta_1:'E',atleta_2:'BYE'},
  {id_visual:'101',proxima_luta:999,fase:'Semifinal',ordem:1,atleta_1:'TBD',atleta_2:'TBD'},
  {id_visual:'102',proxima_luta:999,fase:'Semifinal',ordem:2,atleta_1:'TBD',atleta_2:'TBD'},
  {id_visual:'999',proxima_luta:null,fase:'Final',atleta_1:'TBD',atleta_2:'TBD'},
];
test('dois de um lado e três do outro: quartas 1 vai direto à final, sem semifinal vazia', () => {
  const modelo = combatesPrevistos(cinco)!;
  assert.deepEqual(modelo.lutas.map(l=>l.id_visual), ['1','3','102','999']);
  assert.equal(modelo.origem(modelo.final!,1)?.luta?.id_visual,'1');
  assert.equal(modelo.origem(cinco[5],2)?.atleta?.nome,'E');
  assert.equal(nomeOrigemPrevista(modelo.origem(modelo.final!,1)), 'Vencedor: Quartas de final 1');
});
test('preencher resultados não cria nem esconde combates; chave de três mantém seu fluxo', () => {
  const concluidas=cinco.map(l=>({...l,atleta_1:l.id_visual==='101'?'A':l.atleta_1,vencedor:l.id_visual==='1'?'A':null}));
  assert.deepEqual(combatesPrevistos(concluidas)!.lutas.map(l=>l.id_visual), ['1','3','102','999']);
  assert.equal(combatesPrevistos([{id_visual:1,fase:'Chave de 3'}]),null);
  assert.equal(combatesPrevistos([{id_visual:1,proxima_luta:1}]),null);
});
