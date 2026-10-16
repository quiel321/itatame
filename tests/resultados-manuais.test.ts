import assert from 'node:assert/strict';
import test from 'node:test';
import { bloqueioResultadoManual, type LutaResultadoManual as Luta } from '../app/lib/resultados-manuais';

const luta = (extra: Partial<Luta> = {}): Luta => ({
  id: 'luta', id_visual: '1', categoria: 'Adulto', faixa: 'Branca', fase: 'Semifinal',
  atleta_1: 'Ana', atleta_2: 'Bia', atleta_1_id: 1, atleta_2_id: 2,
  vencedor: null, vencedor_id: null, status_luta: 'agendada', ...extra,
});

test('bloqueia rodada futura enquanto houver alimentadora pendente', () => {
  const primeira = luta({ id: 'primeira', proxima_luta: '999' });
  const final = luta({ id: 'final', id_visual: '999', fase: 'Final' });
  assert.match(bloqueioResultadoManual([primeira, final], final), /lutas anteriores/);
  const anterior = { ...primeira, vencedor: 'Ana', vencedor_id: 1, status_luta: 'concluida' };
  assert.equal(bloqueioResultadoManual([anterior, final], final), '');
  assert.match(bloqueioResultadoManual([anterior, final], { ...final, atleta_1_id: 3 }), /avanços anteriores/);
});

test('repescagem exige a primeira luta e o perdedor correto nos dois lados da chave de seis', () => {
  for (const [origem, destino] of [['1', '2'], ['3', '4']]) {
    const primeira = luta({ id: 'primeira', id_visual: origem, fase: 'Chave de 6', proxima_luta: origem === '1' ? '101' : '102' });
    const baia = luta({ id: 'baia', id_visual: destino, fase: 'Chave de 6', atleta_1_id: 2, atleta_2_id: 3 });
    assert.match(bloqueioResultadoManual([primeira, baia], baia), /lutas anteriores/);
    const anterior = { ...primeira, status_luta: 'concluida', vencedor: 'Ana', vencedor_id: 1 };
    assert.equal(bloqueioResultadoManual([anterior, baia], baia), '');
    assert.match(bloqueioResultadoManual([anterior, baia], { ...baia, atleta_1_id: 1 }), /avanços anteriores/);
  }
});

test('protege resultado existente, placar iniciado, próxima luta e estrutura inválida', () => {
  assert.match(bloqueioResultadoManual([], luta({ vencedor: 'Ana' })), /já registrado/);
  assert.match(bloqueioResultadoManual([], luta({ iniciada_em: '2026-10-15' })), /placar/);
  const atual = luta({ proxima_luta: '999' });
  assert.match(bloqueioResultadoManual([atual], atual), /não encontrada/);
  const final = luta({ id: 'final', id_visual: '999', status_luta: 'em_andamento' });
  assert.match(bloqueioResultadoManual([atual, final], atual), /seguinte/);
  assert.match(bloqueioResultadoManual([atual, { ...atual, id: 'duplicada' }], atual), /ambígua/);
});

test('categorias diferentes não se bloqueiam e ausência de atletas não libera resultado', () => {
  const atual = luta();
  const outra = luta({ id: 'outra', categoria: 'Infantil', proxima_luta: '1' });
  assert.equal(bloqueioResultadoManual([atual, outra], atual), '');
  const vazia = luta({ atleta_1_id: null, atleta_2_id: null });
  assert.match(bloqueioResultadoManual([vazia], vazia), /definição/);
});
