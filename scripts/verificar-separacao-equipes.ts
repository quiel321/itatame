import assert from 'node:assert/strict';
import { montarChaves, prepararGrupos } from '../app/lib/gerar-chaves';
import type { InscricaoCompeticao } from '../app/lib/categorias-competicao';

function inscricoes(equipes: Array<{ nome?: string; id?: string }>): InscricaoCompeticao[] {
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

console.log('Separação de equipes verificada em 1.501 cenários de chaveamento.');
