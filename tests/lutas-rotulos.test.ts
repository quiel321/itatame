import test from 'node:test';
import assert from 'node:assert/strict';
import { rotuloLuta, rotuloLutaCurto } from '../app/lib/lutas-rotulos';
import { combatesPrevistos, nomeOrigemPrevista } from '../app/lib/combates-previstos';

test('códigos internos das semifinais antigas viram números da fase somente na exibição', () => {
  for (const ordem of [101, 102]) {
    const luta = Object.freeze({ id_visual: String(ordem), ordem, fase: 'Semifinal', proxima_luta: 999 });
    assert.equal(rotuloLuta(luta), `Semifinal ${ordem - 100}`);
    assert.equal(rotuloLutaCurto(luta), `Semifinal ${ordem - 100}`);
    assert.equal(luta.ordem, ordem); assert.equal(luta.proxima_luta, 999);
  }
});

test('referências na final também usam semifinal 1 e 2 sem mudar as ligações', () => {
  const lutas = [
    {id_visual:'101',ordem:101,fase:'Semifinal',proxima_luta:999,atleta_1:'A',atleta_2:'B'},
    {id_visual:'102',ordem:102,fase:'Semifinal',proxima_luta:999,atleta_1:'C',atleta_2:'D'},
    {id_visual:'999',ordem:999,fase:'Final',proxima_luta:null,atleta_1:'TBD',atleta_2:'TBD'},
  ];
  const antes = structuredClone(lutas), modelo = combatesPrevistos(lutas)!;
  assert.equal(nomeOrigemPrevista(modelo.origem(lutas[2],1)), 'Vencedor: Semifinal 1');
  assert.equal(nomeOrigemPrevista(modelo.origem(lutas[2],2)), 'Vencedor: Semifinal 2');
  assert.deepEqual(lutas, antes);
});

test('numeração normal, fase explícita, final e chave de três preservadas', () => {
  assert.equal(rotuloLuta({id_visual:'101',ordem:1,fase:'Semifinal'}),'Semifinal 1');
  assert.equal(rotuloLuta({id_visual:'3',ordem:3,fase:'Quartas'}),'Quartas de final 3');
  assert.equal(rotuloLuta({id_visual:'101',ordem:101,fase:'Semifinal 1'}),'Semifinal 1');
  assert.equal(rotuloLuta({id_visual:'999',ordem:999,fase:'Final'}),'Final');
  assert.equal(rotuloLuta({id_visual:'101',ordem:101,fase:'Decisão · Chave de 6'}),'Decisão · esquerda');
});
