import { test } from 'node:test';
import assert from 'node:assert/strict';
import { arquivarConflito, prepararOperacao, enviarOperacao, pendenciasOperacao, guardarRascunho, lerRascunho } from '../app/lib/operacao-persistente';
function storage() {
  const itens = new Map<string,string>();
  return { get length(){return itens.size;},key:(n:number)=>[...itens.keys()][n]??null,getItem:(k:string)=>itens.get(k)??null,setItem:(k:string,v:string)=>{itens.set(k,v);} };
}
const posto={evento:'evento-1',posto:'posto-1'};
test('arquivamento exige recusa explícita e mantém cópia completa antes de liberar nova ação',()=>{
  const s=storage();const p=prepararOperacao(s,posto,'finalizar','luta-1',{lado:1});
  assert.throws(()=>arquivarConflito(s,p,'Falha de rede'),/Confira/);
  arquivarConflito(s,p,'Conflito: resultado alterado');
  const copia=JSON.parse(s.getItem(`itatame:arquivo-operacao:v1:${posto.evento}:${posto.posto}:${p.id}`)!);
  assert.equal(copia.dados.lado,1);assert.equal(pendenciasOperacao(s,posto).length,0);
  assert.notEqual(prepararOperacao(s,posto,'finalizar','luta-1',{lado:2}).id,p.id);
});
test('resposta perdida mantém o mesmo identificador após reabrir e não duplica a ação',async()=>{
  const s=storage();const p=prepararOperacao(s,posto,'finalizar','luta-1',{lado:1},{pontos:5});
  const servidor=new Map<string,unknown>();let efeitos=0;
  await assert.rejects(enviarOperacao(s,p,async r=>{servidor.set(r.id,{confirmada:true,operacao_id:r.id});efeitos++;throw Error('Resposta perdida');}));
  const recuperado=prepararOperacao(s,posto,'finalizar','luta-1',{lado:1},{pontos:5});
  assert.equal(recuperado.id,p.id);assert.equal(pendenciasOperacao(s,posto).length,1);
  await enviarOperacao(s,recuperado,async r=>servidor.get(r.id) as any);
  assert.equal(efeitos,1);assert.equal(pendenciasOperacao(s,posto).length,0);
});
test('não sobrescreve uma intenção pendente com outro peso/resultado',()=>{
  const s=storage();prepararOperacao(s,posto,'checkin','inscricao-1',{peso:70});
  assert.throws(()=>prepararOperacao(s,posto,'checkin','inscricao-1',{peso:80}),/ação sem confirmação/);
  assert.equal(pendenciasOperacao(s,posto)[0].dados.peso,70);
});
test('falha de armazenamento impede envio e não apaga rascunho ilegível',()=>{
  const s=storage();s.setItem=()=>{throw Error('quota');};
  assert.throws(()=>prepararOperacao(s,posto,'pontuacao','luta-1',{}),/proteger/);
  const t=storage();t.setItem('itatame:operacao:v1:evento-1:posto-1:pontuacao:luta-1','inválido');
  assert.throws(()=>pendenciasOperacao(t,posto),/ilegível/);assert.equal(t.length,1);
});
test('rascunho mínimo sobrevive à nova leitura e fica restrito ao posto/evento',()=>{
  const s=storage();guardarRascunho(s,posto,'placar','luta-1',{pontosAzul:7,fimEm:1234});
  assert.deepEqual(lerRascunho(s,posto,'placar','luta-1'),{pontosAzul:7,fimEm:1234});
  assert.equal(lerRascunho(s,{...posto,evento:'outro'},'placar','luta-1'),null);
});
