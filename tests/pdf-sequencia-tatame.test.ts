import test from 'node:test';
import assert from 'node:assert/strict';
import { criarChavesImpressao } from '../app/lib/chaves-impressao';
import { criarKitContingenciaPDF } from '../app/lib/kit-contingencia-pdf';
import { ordenarLutasImpressao } from '../app/lib/ordem-impressao-tatames';
import { exemploKit } from './kit-contingencia-pdf.test';

export function exemploSequencia() {
  const o = exemploKit([4, 2, 2, 2, 2]);
  const nomes = ['ALFA DEPOIS', 'ZETA PRIMEIRO', 'BETA TATAME 10', 'GAMA TATAME 2', 'SEM DISTRIBUICAO'];
  const tatames = ['Tatame 1', 'Tatame 1', 'Tatame 10', 'Tatame 2', null];
  const ordens = [20, 2, 1, 1, null];
  for (const i of o.inscricoes!) i.categoria = nomes[Number(i.categoria_id!.split('-')[1])];
  for (const l of o.lutas) {
    const n = Number(l.categoria_id!.split('-')[1]);
    l.categoria = nomes[n]; l.tatame = tatames[n]; l.ordem_tatame = ordens[n];
    l.horario_estimado = n === 0 ? '2026-10-17T10:00:00Z' : '2026-10-17T14:00:00Z';
  }
  o.lutas.reverse();
  return o;
}
const esperada = ['ZETA PRIMEIRO', 'ALFA DEPOIS', 'GAMA TATAME 2', 'BETA TATAME 10', 'SEM DISTRIBUICAO'];

test('kit e PDF das chaves seguem a mesma sequência salva, por tatame e posição', () => {
  const o = exemploSequencia(), antes = structuredClone(o);
  const kit = criarKitContingenciaPDF(o);
  const chaves = criarChavesImpressao({ eventoNome: o.eventoNome, lutas: o.lutas });
  const folhasKit = kit.internal.pages as unknown as string[][];
  const folhasChaves = chaves.internal.pages as unknown as string[][];
  assert.equal(kit.getNumberOfPages(), 10);
  assert.equal(chaves.getNumberOfPages(), 5);
  esperada.forEach((nome, n) => {
    assert.ok(folhasKit[n + 1].join('\n').includes(nome), `recepção: ${nome}`);
    assert.ok(folhasKit[n + 6].join('\n').includes(nome), `árvore do kit: ${nome}`);
    assert.ok(folhasChaves[n + 1].join('\n').includes(nome), `chaves: ${nome}`);
  });
  const areas = ['Tatame 1', 'Tatame 1', 'Tatame 2', 'Tatame 10'];
  areas.forEach((area, n) => {
    const folha = folhasKit[n + 1].join('\n');
    assert.ok(folha.includes(`ÁREA: ${area}`));
    assert.ok(folha.includes(`Tatame: ${area}  Envio:`));
  });
  assert.ok(folhasKit[5].join('\n').includes('ÁREA: Não definida'));
  assert.deepEqual(o, antes);
});

test('área da recepção se repete nas continuações e não presume um tatame em categoria dividida', () => {
  const o = exemploKit([16]);
  for (const l of o.lutas) l.tatame = 'Tatame 2';
  const kit = criarKitContingenciaPDF(o);
  const folhas = kit.internal.pages as unknown as string[][];
  assert.ok(folhas[1].join('\n').includes('ÁREA: Tatame 2'));
  assert.ok(folhas[2].join('\n').includes('ÁREA: Tatame 2'));
  o.lutas[0].tatame = 'Tatame 1';
  const dividido = (criarKitContingenciaPDF(o).internal.pages as unknown as string[][])[1].join('\n');
  assert.ok(dividido.includes('ÁREA: Tatame 1 / Tatame 2'));
  assert.ok(dividido.includes('Tatame: ______  Envio:'));
});

test('sem tatame fica ao final; posição ausente fica depois da fila salva no mesmo tatame', () => {
  const entrada = [
    { categoria: 'SEM ORDEM', tatame: 'Tatame 1', ordem_tatame: null },
    { categoria: 'SEM TATAME', tatame: 'Não definido', ordem_tatame: 1 },
    { categoria: 'SEGUNDA', tatame: ' tatame 1 ', ordem_tatame: 20 },
    { categoria: 'PRIMEIRA', tatame: 'Tatame 1', ordem_tatame: 2 },
  ];
  assert.deepEqual(ordenarLutasImpressao(entrada).map(i => i.categoria), ['PRIMEIRA', 'SEGUNDA', 'SEM ORDEM', 'SEM TATAME']);
});
