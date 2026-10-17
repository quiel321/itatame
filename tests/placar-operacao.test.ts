import test from 'node:test';
import assert from 'node:assert/strict';
import { liberadaParaMesario, vencedorPorPlacar } from '../app/lib/placar-operacao';

test('mesário aguarda chamador e pode retomar uma luta pausada', () => {
  assert.equal(liberadaParaMesario({status_luta:'agendada',iniciada_em:null}),false);
  assert.equal(liberadaParaMesario({status_luta:'agendada',iniciada_em:'2026-10-17T00:00:00Z'}),true);
  assert.equal(liberadaParaMesario({status_luta:'em_andamento',iniciada_em:null}),true);
  assert.equal(liberadaParaMesario({status_luta:'concluida',iniciada_em:null}),false);
});
test('conferência de placar considera pontos, vantagens e punições, sem inventar desempate', () => {
  const p={pontos:0,vantagens:0,punicoes:0};
  assert.equal(vencedorPorPlacar({...p,pontos:2},p),'azul');
  assert.equal(vencedorPorPlacar(p,{...p,vantagens:1}),'vermelho');
  assert.equal(vencedorPorPlacar({...p,punicoes:1},p),'vermelho');
  assert.equal(vencedorPorPlacar(p,p),null);
});
