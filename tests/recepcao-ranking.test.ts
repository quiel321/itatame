import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularResultadosChaves } from '../app/lib/ranking-eventos';
test('vaga herdada de ausência não concede medalha nem pontos por W.O. operacional', () => {
 const luta={id_visual:'999',fase:'Final',status_luta:'concluida',atleta_1:'Alice',atleta_1_id:1,atleta_2:'BYE',vencedor:'Alice',vencedor_id:1,metodo_vitoria:'wo',pontuacao_atleta_1:{recepcao_wo:true}};
 assert.deepEqual(calcularResultadosChaves([luta]),{atletas:[],equipes:[]});
 const estrutural=calcularResultadosChaves([{...luta,pontuacao_atleta_1:{}}]);
 assert.equal(estrutural.atletas[0].ouro,1);assert.equal(estrutural.atletas[0].pts,9);
});

