import test from 'node:test';
import assert from 'node:assert/strict';
import { montarChaves } from '../app/lib/gerar-chaves';
import { criarChavesImpressao, type LutaImpressao } from '../app/lib/chaves-impressao';

test('PDF preserva participantes, posições e confrontos em chaves pequenas e paginadas', () => {
  for (const total of [1, 2, 3, 4, 6, 8, 13, 16, 32, 64]) {
    const lutas = montarChaves('FICTICIO', {
      grupos: { G: Array.from({ length: total }, (_, i) => ({
        atleta_id: i + 1, atleta: `ATLETA-${String(i + 1).padStart(3, '0')}`,
        equipe_atleta: 'EQUIPE FICTICIA', equipe_chave: `EQUIPE ${i}`,
      })) },
      metadados: { G: { categoria: 'CATEGORIA FICTICIA', categoria_id: 'FICTICIA', faixa: 'Branca', tempo_minutos: 3 } },
    }) as unknown as LutaImpressao[];
    const antes = structuredClone(lutas);
    const doc = criarChavesImpressao({ eventoNome: 'DEMONSTRACAO', lutas });
    const conteudo = doc.output();
    assert.deepEqual(lutas, antes);
    assert.equal(doc.getNumberOfPages(), total <= 16 ? 1 : total === 32 ? 3 : 7);
    for (let i = 1; i <= total; i++) {
      const nome = `ATLETA-${String(i).padStart(3, '0')}`;
      assert.equal(conteudo.split(nome).length - 1, 1, `${total} participantes: ${nome} aparece uma vez na origem`);
    }
    assert.ok(!conteudo.includes('(BYE)'));
    if (total > 16) assert.ok(conteudo.includes('Continua da p'));
    assert.ok(conteudo.includes('RESULTADO FINAL'));
  }
});

test('PDF rejeita uma árvore inválida em vez de imprimir confrontos desconectados', () => {
  assert.throws(() => criarChavesImpressao({ eventoNome: 'TESTE', lutas: [] }), /Nenhuma chave/);
  assert.throws(() => criarChavesImpressao({ eventoNome: 'TESTE', lutas: [
    { categoria: 'TESTE', faixa: 'Branca', id_visual: '1', proxima_luta: null },
    { categoria: 'TESTE', faixa: 'Branca', id_visual: '2', proxima_luta: null },
  ] as LutaImpressao[] }), /final ausente ou duplicada/);
});
