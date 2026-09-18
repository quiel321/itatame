import assert from 'node:assert/strict';
import { montarChaves, prepararGrupos } from '../app/lib/gerar-chaves';
import type { InscricaoCompeticao } from '../app/lib/categorias-competicao';

function inscricoes(equipes: Array<{ nome?: string; id?: string; academia?: string }>): InscricaoCompeticao[] {
  return equipes.map((equipe, indice) => ({
    id: `inscricao-${indice + 1}`,
    atleta_id: indice + 1,
    atleta: `Atleta ${indice + 1}`,
    categoria: 'Leve',
    faixa: 'Branca',
    sexo: 'Masculino',
    idade: 25,
    peso: 70,
    equipe: equipe.nome || '',
    equipe_id: equipe.id || null,
    academia: equipe.academia || '',
    pagamento_ok: true,
  }));
}

const categoriaLeve = {
  id: 'leve',
  evento_id: 'evento-teste',
  nome: 'Leve',
  modalidade: 'Jiu-Jitsu',
  sexo: 'Masculino',
  faixa: 'Branca',
  idade_min: 18,
  idade_max: 29,
  peso_min: 0,
  peso_max: 200,
  tempo_minutos: 5,
  tipo: 'peso' as const,
  ativa: true,
};

function ladosPorEquipe(equipes: Array<{ nome?: string; id?: string }>) {
  const preparados = prepararGrupos(inscricoes(equipes), 'peso', [categoriaLeve]);
  const lutas = montarChaves('evento-teste', preparados);
  const lados = new Map<string, Set<string>>();
  lutas.forEach((luta) => {
    for (const numero of [1, 2] as const) {
      const atletaId = luta[`atleta_${numero}_id`];
      if (!atletaId) continue;
      const equipe = equipes[Number(atletaId) - 1];
      const chave = equipe.id ? `ID:${equipe.id}` : `NOME:${equipe.nome?.trim().toUpperCase()}`;
      const valores = lados.get(chave) || new Set<string>();
      valores.add(String(luta.lado));
      lados.set(chave, valores);
    }
  });
  return lados;
}

for (let repeticao = 0; repeticao < 500; repeticao += 1) {
  const duasEquipes = ladosPorEquipe([
    { nome: 'Equipe A' }, { nome: 'Equipe A' },
    { nome: 'Equipe B' }, { nome: 'Equipe B' },
    { nome: 'Equipe C' },
  ]);
  assert.deepEqual([...duasEquipes.get('NOME:EQUIPE A')!].sort(), ['direita', 'esquerda']);
  assert.deepEqual([...duasEquipes.get('NOME:EQUIPE B')!].sort(), ['direita', 'esquerda']);

  const grupoDesbalanceado = ladosPorEquipe([
    { nome: 'Equipe A' }, { nome: 'Equipe A' }, { nome: 'Equipe A' },
    { nome: 'Equipe B' }, { nome: 'Equipe B' },
  ]);
  assert.deepEqual([...grupoDesbalanceado.get('NOME:EQUIPE B')!].sort(), ['direita', 'esquerda']);

  const equipeCanonica = ladosPorEquipe([
    { nome: 'Matriz', id: 'equipe-1' }, { nome: 'Filial', id: 'equipe-1' },
    { nome: 'Outra' }, { nome: 'Terceira' },
  ]);
  assert.deepEqual([...equipeCanonica.get('ID:equipe-1')!].sort(), ['direita', 'esquerda']);
}

const triangular = montarChaves('evento-teste', prepararGrupos(inscricoes([
  { nome: 'Equipe A' }, { nome: 'Equipe A' }, { nome: 'Equipe B' },
]), 'peso', [categoriaLeve]));
assert.notEqual(triangular[0].equipe_1, triangular[0].equipe_2, 'A primeira luta da chave de três deve priorizar equipes diferentes.');

for (let repeticao = 0; repeticao < 200; repeticao += 1) {
  const seis = montarChaves('evento-teste', prepararGrupos(inscricoes([
    { nome: 'Equipe A' }, { nome: 'Equipe A' }, { nome: 'Equipe A' },
    { nome: 'Equipe B' }, { nome: 'Equipe B' }, { nome: 'Equipe B' },
  ]), 'peso', [categoriaLeve]));
  assert.equal(seis.filter(luta => String(luta.fase || '').includes('Chave de 3') || String(luta.fase || '').includes('Chave de 6')).length, 7);
  const luta1 = seis.find(luta => String(luta.id_visual) === '1');
  const luta3 = seis.find(luta => String(luta.id_visual) === '3');
  assert.notEqual(luta1?.equipe_1, luta1?.equipe_2, 'Primeira luta da esquerda deve priorizar equipes diferentes.');
  assert.notEqual(luta3?.equipe_1, luta3?.equipe_2, 'Primeira luta da direita deve priorizar equipes diferentes.');
  assert.ok(seis.some(luta => luta.lado === 'esquerda'));
  assert.ok(seis.some(luta => luta.lado === 'direita'));

  const academias = montarChaves('evento-teste', prepararGrupos(inscricoes([
    { nome: 'LEGADO', academia: 'SPARTAN' },
    { nome: 'LEGADO', academia: 'SPARTAN' },
    { nome: 'LEGADO', academia: 'PORRADA' },
    { nome: 'LEGADO', academia: 'SPARTAN' },
    { nome: 'LEGADO', academia: 'PORRADA' },
    { nome: 'LEGADO', academia: 'PORRADA' },
  ]), 'peso', [categoriaLeve]));
  const academiasPorId = new Map(inscricoes([
    { nome: 'LEGADO', academia: 'SPARTAN' },
    { nome: 'LEGADO', academia: 'SPARTAN' },
    { nome: 'LEGADO', academia: 'PORRADA' },
    { nome: 'LEGADO', academia: 'SPARTAN' },
    { nome: 'LEGADO', academia: 'PORRADA' },
    { nome: 'LEGADO', academia: 'PORRADA' },
  ]).map(item => [item.atleta_id, item.academia]));
  for (const id of ['1', '3']) {
    const luta = academias.find(item => String(item.id_visual) === id);
    const academia1 = academiasPorId.get(Number(luta?.atleta_1_id));
    const academia2 = academiasPorId.get(Number(luta?.atleta_2_id));
    assert.notEqual(academia1, academia2, `Primeira luta ${id} deve priorizar academias diferentes quando a equipe é a mesma.`);
  }
}

console.log('Separação de equipes verificada em 1.501 cenários de chaveamento.');
