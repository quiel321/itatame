import test from 'node:test';
import assert from 'node:assert/strict';
import { processarAvancosAutomaticosChaves } from '../app/lib/chaves-auto-avanco';

function banco(falharLeitura = false) {
  const chamadas: string[] = [];
  return { chamadas, from(tabela: string) {
    const filtros = new Map<string, unknown>();
    const consulta: any = {
      select() { return consulta; }, eq(k: string, v: unknown) { filtros.set(k,v); return consulta; },
      then(resolve: any, reject: any) {
        const resultado = tabela === 'recepcao_categorias'
          ? { data: ['atual','outra'].filter(c => !filtros.has('categoria_id') || filtros.get('categoria_id') === c).map(categoria_id => ({categoria_id})), error: null }
          : {data: [], error: falharLeitura ? {message:'Sem conexão'} : null};
        return Promise.resolve(resultado).then(resolve,reject);
      },
    };
    return consulta;
  }, async rpc(_nome: string, args: Record<string, unknown>) {
    chamadas.push(String(args.p_categoria));
    return {error: args.p_categoria === 'outra' ? {message:'Outra categoria já operada'} : null};
  }};
}

test('despacho atualiza somente sua categoria e não é bloqueado por outra categoria já operada', async () => {
  const db=banco();
  assert.equal(await processarAvancosAutomaticosChaves(db,'evento','atual'),false);
  assert.deepEqual(db.chamadas,['atual','atual']);
});
test('falha posterior de leitura é informada em vez de ser apresentada como avanço concluído', async () => {
  const db=banco(true);
  await assert.rejects(processarAvancosAutomaticosChaves(db,'evento','atual'),{message:'Sem conexão'});
});
