import assert from 'node:assert/strict';
import test from 'node:test';
import { montarChaves, prepararGrupos } from '../app/lib/gerar-chaves';
import type { CategoriaCompeticao, InscricaoCompeticao } from '../app/lib/categorias-competicao';

const absoluto: CategoriaCompeticao = {
  id: 'absoluto-teste', evento_id: 'evento-teste', nome: 'Absoluto', modalidade: 'Jiu-Jitsu',
  sexo: 'Masculino', faixa: 'Branca', idade_min: 18, idade_max: 40,
  peso_min: 0, peso_max: null, tempo_minutos: 5, tipo: 'absoluto', ativa: true,
};

type Atleta = { peso: number; equipe: string; academia: string };
type Luta = { id_visual: string; atleta_1_id: number | null; atleta_2_id: number | null };

function primeirasLutas(atletas: Atleta[]) {
  const inscricoes: InscricaoCompeticao[] = atletas.map((atleta, indice) => ({
    id: String(indice + 1), atleta_id: indice + 1, atleta: `Atleta ${indice + 1}`,
    idade: 25, sexo: 'Masculino', faixa: 'Branca', modalidade: 'Jiu-Jitsu',
    categoria: 'Absoluto', absoluto: true, pagamento_ok: true, ...atleta,
  }));
  const lutas = montarChaves('evento-teste', prepararGrupos(inscricoes, 'absoluto', [absoluto])) as Luta[];
  const ids = atletas.length === 6 ? ['1', '3'] : Array.from({ length: atletas.length === 3 ? 1 : Math.ceil(atletas.length / 2) }, (_, i) => String(i + 1));
  return lutas.filter(luta => ids.includes(luta.id_visual) && luta.atleta_1_id && luta.atleta_2_id);
}

test('absoluto de 3 atletas estreia com os pesos mais próximos quando equipes e academias diferem', () => {
  const atletas = [
    { peso: 60, equipe: 'A', academia: 'Academia A' },
    { peso: 61, equipe: 'B', academia: 'Academia B' },
    { peso: 100, equipe: 'C', academia: 'Academia C' },
  ];
  for (let tentativa = 0; tentativa < 20; tentativa++) {
    const [luta] = primeirasLutas(atletas);
    assert.deepEqual([luta.atleta_1_id, luta.atleta_2_id].sort(), [1, 2]);
  }
});

test('absoluto de 4 atletas evita peso distante na estreia', () => {
  const atletas = [
    { peso: 60, equipe: 'A', academia: 'Academia A' },
    { peso: 61, equipe: 'B', academia: 'Academia B' },
    { peso: 100, equipe: 'C', academia: 'Academia C' },
    { peso: 101, equipe: 'D', academia: 'Academia D' },
  ];
  for (let tentativa = 0; tentativa < 20; tentativa++) {
    const lutas = primeirasLutas(atletas);
    assert.equal(lutas.length, 2);
    assert.equal(lutas.every(luta => Math.abs(atletas[luta.atleta_1_id! - 1].peso - atletas[luta.atleta_2_id! - 1].peso) === 1), true);
  }
});

test('absoluto prioriza academias distintas e mantém colegas de equipe em lados opostos', () => {
  const atletas = [
    { peso: 60, equipe: 'Equipe A', academia: 'Academia X' },
    { peso: 61, equipe: 'Equipe B', academia: 'Academia X' },
    { peso: 62, equipe: 'Equipe C', academia: 'Academia Y' },
    { peso: 63, equipe: 'Equipe D', academia: 'Academia Y' },
    { peso: 100, equipe: 'Equipe A', academia: 'Academia X' },
    { peso: 101, equipe: 'Equipe B', academia: 'Academia X' },
    { peso: 102, equipe: 'Equipe C', academia: 'Academia Y' },
    { peso: 103, equipe: 'Equipe D', academia: 'Academia Y' },
  ];
  for (let tentativa = 0; tentativa < 20; tentativa++) {
    const lutas = primeirasLutas(atletas);
    assert.equal(lutas.length, 4);
    for (const luta of lutas) {
      const a = atletas[luta.atleta_1_id! - 1];
      const b = atletas[luta.atleta_2_id! - 1];
      assert.notEqual(a.equipe, b.equipe);
      assert.notEqual(a.academia, b.academia);
    }
  }
});

test('na chave de 6, as duas estreias aproximam pesos quando não há conflito de equipe', () => {
  const atletas = [60, 61, 62, 100, 101, 102].map((peso, indice) => ({ peso, equipe: `Equipe ${indice}`, academia: `Academia ${indice}` }));
  for (let tentativa = 0; tentativa < 20; tentativa++) {
    const lutas = primeirasLutas(atletas);
    assert.equal(lutas.length, 2);
    assert.equal(lutas.every(luta => Math.abs(atletas[luta.atleta_1_id! - 1].peso - atletas[luta.atleta_2_id! - 1].peso) <= 2), true);
  }
});

test('chaves de 16, 32 e 64 atletas preservam estreias próximas quando há opções', () => {
  for (const quantidade of [16, 32, 64]) {
    const atletas = Array.from({ length: quantidade }, (_, indice) => ({
      peso: indice < quantidade / 2 ? 60 + indice : 120 + indice - quantidade / 2,
      equipe: `Equipe ${indice}`,
      academia: `Academia ${indice}`,
    }));
    const lutas = primeirasLutas(atletas);
    assert.equal(lutas.length, quantidade / 2);
    assert.equal(lutas.every(luta => Math.abs(atletas[luta.atleta_1_id! - 1].peso - atletas[luta.atleta_2_id! - 1].peso) <= 1), true);
  }
});

test('dois atletas da mesma equipe ficam em lados opostos da chave de 8', () => {
  const atletas = Array.from({ length: 8 }, (_, indice) => ({
    peso: 60 + indice,
    equipe: indice < 2 ? 'Equipe repetida' : `Equipe ${indice}`,
    academia: `Academia ${indice}`,
  }));
  for (let tentativa = 0; tentativa < 20; tentativa++) {
    const lutas = primeirasLutas(atletas);
    assert.equal(lutas.some(luta => [luta.atleta_1_id, luta.atleta_2_id].includes(1) && [luta.atleta_1_id, luta.atleta_2_id].includes(2)), false);
  }
});

test('academias diferentes têm prioridade sobre a proximidade de peso', () => {
  const atletas = [
    { peso: 60, equipe: 'Equipe A', academia: 'Academia X' },
    { peso: 61, equipe: 'Equipe B', academia: 'Academia X' },
    { peso: 100, equipe: 'Equipe C', academia: 'Academia Y' },
    { peso: 101, equipe: 'Equipe D', academia: 'Academia Y' },
  ];
  for (let tentativa = 0; tentativa < 20; tentativa++) {
    const lutas = primeirasLutas(atletas);
    assert.equal(lutas.length, 2);
    assert.equal(lutas.every(luta => atletas[luta.atleta_1_id! - 1].academia !== atletas[luta.atleta_2_id! - 1].academia), true);
  }
});

test('a separação de academias funciona mesmo com quatro atletas de cada academia', () => {
  const atletas = Array.from({ length: 8 }, (_, indice) => ({
    peso: indice < 4 ? 60 + indice : 100 + indice - 4,
    equipe: `Equipe ${indice}`,
    academia: indice < 4 ? 'Academia X' : 'Academia Y',
  }));
  const lutas = primeirasLutas(atletas);
  assert.equal(lutas.length, 4);
  assert.equal(lutas.every(luta => atletas[luta.atleta_1_id! - 1].academia !== atletas[luta.atleta_2_id! - 1].academia), true);
});

test('chaves com baias mantêm todos os atletas exatamente uma vez na primeira fase', () => {
  for (const quantidade of [5, 7, 9]) {
    const atletas = Array.from({ length: quantidade }, (_, indice) => ({
      peso: 60 + indice, equipe: `Equipe ${indice}`, academia: `Academia ${indice}`,
    }));
    const inscricoes: InscricaoCompeticao[] = atletas.map((atleta, indice) => ({
      id: String(indice + 1), atleta_id: indice + 1, atleta: `Atleta ${indice + 1}`,
      idade: 25, sexo: 'Masculino', faixa: 'Branca', modalidade: 'Jiu-Jitsu',
      categoria: 'Absoluto', absoluto: true, pagamento_ok: true, ...atleta,
    }));
    const lutas = montarChaves('evento-teste', prepararGrupos(inscricoes, 'absoluto', [absoluto])) as Luta[];
    const tamanho = 2 ** Math.ceil(Math.log2(quantidade));
    const ids = lutas.filter(luta => Number(luta.id_visual) <= tamanho / 2)
      .flatMap(luta => [luta.atleta_1_id, luta.atleta_2_id]).filter((id): id is number => id !== null);
    assert.deepEqual(ids.sort((a, b) => a - b), Array.from({ length: quantidade }, (_, indice) => indice + 1));
  }
});
