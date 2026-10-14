import test from 'node:test';
import assert from 'node:assert/strict';
import { consultarChavesPublicadas } from '../app/lib/chaves-publicadas';
function banco(publicacoes: any[], erro = false) {
 const chamadas: any[] = [];
 return { chamadas, from(tabela: string) {
  const filtros: any[] = []; const q: any = {
   select: () => q, eq: (k: string,v: any) => { filtros.push([k,v]); return q; },
   in: (k: string,v: any) => { filtros.push([k,v]); return q; },
   then: (resolver: any) => { chamadas.push({tabela,filtros}); return Promise.resolve(resolver({ data: tabela === 'chaves_publicacoes' ? publicacoes : [{id:'luta-publicada'}], error: erro ? {message:'Falha'} : null })); },
  }; return q;
 }};
}
test('página pública de organizador não consulta rascunhos quando nenhuma categoria está publicada', async () => {
 const db=banco([]); const r=await consultarChavesPublicadas(db,'evento','*');
 assert.deepEqual(r.data,[]); assert.equal(db.chamadas.length,1);
 assert.ok(db.chamadas[0].filtros.some(([k,v]: any[])=>k==='publicada'&&v===true));
});
test('consulta de confrontos limita IDs às categorias publicadas e mantém divisão/faixa', async () => {
 const db=banco([{categoria_id:'publicada'}]); await consultarChavesPublicadas(db,'evento','*','Infantil','Branca');
 assert.deepEqual(db.chamadas[1].filtros,[['evento_id','evento'],['categoria_id',['publicada']],['categoria','Infantil'],['faixa','Branca']]);
});
test('erro na publicação não abre consulta irrestrita', async () => {
 const db=banco([],true); const r=await consultarChavesPublicadas(db,'evento','*');
 assert.equal(db.chamadas.length,1); assert.deepEqual(r.data,[]);assert.ok(r.error);
});

