import test from 'node:test';
import assert from 'node:assert/strict';
import { resumoAvancoSemCombate } from '../app/lib/avanco-sem-combate';
const luta={id_visual:'2',proxima_luta:101,fase:'Quartas',atleta_1:'FICTÍCIO',atleta_2:'BYE',equipe_1:'EQUIPE',status_luta:'agendada'};
const semi={id_visual:'101',proxima_luta:999,fase:'Semifinal'};
test('avanço explícito sem adversário informa semifinal sem inventar luta nem confirmar check-in',()=>{
 const copia=structuredClone(luta),r=resumoAvancoSemCombate(luta,[luta,semi])!;
 assert.equal(r.titulo,'Avanço direto à semifinal');assert.equal(r.nome,'FICTÍCIO');assert.equal(r.confirmado,false);assert.deepEqual(luta,copia);
 assert.equal(resumoAvancoSemCombate({...luta,status_luta:'concluida',vencedor:'FICTÍCIO'},[luta,semi])!.confirmado,true);
});
test('TBD, futuro com alimentadora, chave de três, cancelada e categoria de atleta único não viram avanço direto',()=>{
 for(const l of [{...luta,atleta_2:'TBD'},{...luta,atleta_2:''},{...luta,fase:'Baia · Chave de 3'},{...luta,status_luta:'cancelada'},{...luta,proxima_luta:null}])assert.equal(resumoAvancoSemCombate(l,[l,semi]),null);
 assert.equal(resumoAvancoSemCombate(luta,[luta,semi,{id_visual:'1',proxima_luta:2}]),null);
});
test('nome vem do lado real e rótulo usa a próxima fase efetiva',()=>{
 const a={...luta,atleta_1:'BYE',atleta_2:'FICTÍCIO 2',proxima_luta:999};
 const r=resumoAvancoSemCombate(a,[a,{id_visual:'999',fase:'Final'}])!;assert.equal(r.nome,'FICTÍCIO 2');assert.equal(r.lado,2);assert.equal(r.titulo,'Avanço direto à final');
});
