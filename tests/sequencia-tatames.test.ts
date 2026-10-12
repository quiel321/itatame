import assert from 'node:assert/strict';
import test from 'node:test';
import { compararCategoriasIdadePeso, filaCategoriasTatame, planejarSequenciaTatames, type LutaSequencia } from '../app/lib/sequencia-tatames';

const luta = (id: string, categoria: string, ordem: number, extras: Partial<LutaSequencia> = {}): LutaSequencia => ({
  id, categoria, faixa: 'Branca', tatame: 'Tatame 1', ordem_tatame: ordem,
  fase: 'FINAL', status_luta: 'agendada', atleta_1: 'Atleta fictício A', atleta_2: 'Atleta fictício B', ...extras,
});
const categorias = (nomes: string[], tatameAtual = 'Tatame 1') => nomes.map(nome => ({ idUnico: `${nome}__Branca`, tatameAtual }));

test('idade vem antes de peso; metadados desconhecidos ficam no final', () => {
  const dados = [{ nome: 'Adulto', faixa: 'Branca', idadeMin: 18, pesoMin: 0 },
    { nome: 'Infantil pesado', faixa: 'Branca', idadeMin: 9, pesoMin: 37 },
    { nome: 'Antiga', faixa: 'Branca' }, { nome: 'Infantil leve', faixa: 'Branca', idadeMin: 9, pesoMin: 0 }];
  assert.deepEqual(dados.sort(compararCategoriasIdadePeso).map(c => c.nome), ['Infantil leve', 'Infantil pesado', 'Adulto', 'Antiga']);
});

test('ordem escolhida prevalece sobre nome e fica igual na fila de categorias do chamador', () => {
  const originais = [luta('1', 'Adulto', 1), luta('2', 'Mirim', 2)];
  const copia = structuredClone(originais);
  const plano = planejarSequenciaTatames(originais, categorias(['Mirim', 'Adulto']));
  assert.deepEqual(plano.map(l => [l.id, l.ordem_tatame]), [['2', 1], ['1', 2]]);
  const salvas = originais.map(l => ({ ...l, ...plano.find(p => p.id === l.id) }));
  assert.deepEqual(filaCategoriasTatame(salvas).map(c => c.luta.categoria), ['Mirim', 'Adulto']);
  assert.deepEqual(originais, copia);
});

test('alteração limpa só horários dos tatames afetados e não toca resultados ou atletas', () => {
  const lutas = [luta('1', 'Adulto', 1, { horario_estimado: '2026-10-17T13:00:00Z' }),
    luta('2', 'Mirim', 2), luta('3', 'Outro', 1, { tatame: 'Tatame 2', iniciada_em: '2026-10-17T14:00:00Z' })];
  const plano = planejarSequenciaTatames(lutas, [...categorias(['Mirim', 'Adulto']), ...categorias(['Outro'], 'Tatame 2')]);
  assert.equal(plano.length, 2); assert(plano.every(p => p.horario_estimado === null));
  assert(plano.every(p => !('atleta_1' in p) && !('status_luta' in p) && !('vencedor' in p)));
});

test('chamada, andamento ou resultado real impedem reordenação; BYE automático não impede', () => {
  for (const extras of [{ iniciada_em: '2026-10-17T13:00:00Z' }, { status_luta: 'em_andamento' }, { vencedor: 'Atleta fictício A' }])
    assert.throws(() => planejarSequenciaTatames([luta('1', 'Adulto', 1, extras), luta('2', 'Mirim', 2)], categorias(['Mirim', 'Adulto'])), /preservada/);
  assert.doesNotThrow(() => planejarSequenciaTatames([luta('1', 'Adulto', 1, { atleta_2: 'BYE', vencedor: 'Atleta fictício A', status_luta: 'concluida' }), luta('2', 'Mirim', 2)], categorias(['Mirim', 'Adulto'])));
});

test('chaves de três/seis mantêm luta, baia, decisão e final; inclui fases sem atletas definidos', () => {
  const fases = ['999', '101', '2', '1'].map((id, i) => luta(id, 'Infantil', i + 1, { id_visual: id, fase: 'CHAVE DE 3', atleta_1: id === '999' ? 'TBD' : 'Atleta A', atleta_2: 'TBD' }));
  const plano = planejarSequenciaTatames(fases, categorias(['Infantil']));
  assert.deepEqual(plano.map(l => l.id), ['1', '2', '101', '999']);
});

test('planejamento idêntico não escreve nem invalida horários', () => {
  assert.deepEqual(planejarSequenciaTatames([luta('1', 'Mirim', 1)], categorias(['Mirim'])), []);
});
