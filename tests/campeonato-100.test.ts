import assert from 'node:assert/strict';
import test from 'node:test';
import { montarChaves, prepararGrupos } from '../app/lib/gerar-chaves';
import { processarAvancosAutomaticosChaves, propagarResultadoChave, isChaveAtletaReal, type ChaveLutaAuto } from '../app/lib/chaves-auto-avanco';
import { calcularResultadosChaves } from '../app/lib/ranking-eventos';
import type { CategoriaCompeticao } from '../app/lib/categorias-competicao';

for (const tipo of ['peso', 'absoluto'] as const) {
  test(`100 atletas fictícios: ${tipo}, avanços e finais chegam ao ranking sem serviços reais`, async () => {
    const categoria: CategoriaCompeticao = { id:'categoria-teste',evento_id:'evento-teste',nome:tipo==='peso'?'Peso':'Absoluto',modalidade:'Jiu-Jitsu',sexo:'Masculino',faixa:'Branca',idade_min:16,idade_max:100,peso_min:0,peso_max:null,tempo_minutos:5,tipo,ativa:true };
    const inscritos=Array.from({length:100},(_,i)=>({id:i+1,atleta_id:i+1,atleta:`Fictício ${i+1}`,categoria_id:categoria.id,categoria:categoria.nome,faixa:'Branca',sexo:'Masculino',idade:20,peso:70+i/10,modalidade:'Jiu-Jitsu',equipe:`Equipe ${i%10}`,academia:`CT ${i%20}`,absoluto:tipo==='absoluto',pagamento_ok:true,status_checkin:'aprovado'}));
    const grupos=prepararGrupos(inscritos,tipo,[categoria]);
    assert.equal(Object.values(grupos.grupos).flat().length,100);
    const lutas=(montarChaves('evento-teste',grupos) as unknown as ChaveLutaAuto[]).map((luta,i)=>({...luta,id:`luta-${i}`,categoria_id:categoria.id,status_luta:'agendada'}));
    const db={from:(tabela:string)=>{
      if(tabela==='recepcao_categorias')return {select:()=>({eq:()=>({eq:async()=>({data:[{categoria_id:categoria.id}],error:null})})})};
      assert.ok(['chaves','inscricoes'].includes(tabela),'Não acessar cadastro de atletas');
      return {
        select:()=>({eq:()=>Object.assign(Promise.resolve({data:structuredClone(tabela==='chaves'?lutas:inscritos),error:null}),{in:async()=>({data:inscritos,error:null})})}),
        update:(payload:Record<string,unknown>)=>{
          assert.equal(tabela,'chaves');const filtros:((l:any)=>boolean)[]=[];
          const q:any={eq:(c:string,v:unknown)=>{filtros.push(l=>l[c]===v);return q;},neq:(c:string,v:unknown)=>{filtros.push(l=>l[c]!==v);return q;},is:(c:string,v:unknown)=>{filtros.push(l=>(l[c]??null)===v);return q;},select:()=>q,then:(resolve:any)=>{const alvos=lutas.filter(l=>filtros.every(f=>f(l)));alvos.forEach(l=>Object.assign(l,payload));return Promise.resolve({data:alvos.map(l=>({id:l.id})),error:null}).then(resolve);}};return q;
        },
      };
    }};
    for(let rodada=0;rodada<150;rodada++){
      await processarAvancosAutomaticosChaves(db,'evento-teste');
      const luta=lutas.find(x=>x.status_luta!=='concluida'&&isChaveAtletaReal(x.atleta_1)&&isChaveAtletaReal(x.atleta_2));
      if(!luta)break;
      Object.assign(luta,{status_luta:'concluida',vencedor:luta.atleta_1,vencedor_id:luta.atleta_1_id,metodo_vitoria:'pontos'});
      await propagarResultadoChave(db,lutas,luta,{vencedorNome:luta.atleta_1!,vencedorId:luta.atleta_1_id,vencedorEquipe:luta.equipe_1,perdedorNome:luta.atleta_2,perdedorId:luta.atleta_2_id,perdedorEquipe:luta.equipe_2});
    }
    await processarAvancosAutomaticosChaves(db,'evento-teste');
    assert.equal(lutas.filter(x=>x.status_luta!=='concluida').length,0,'Nenhuma luta travada');
    const finais=lutas.filter(x=>String(x.fase).toLowerCase().startsWith('final'));
    assert.equal(finais.length,2);assert.ok(finais.every(x=>x.vencedor_id));
    const ranking=calcularResultadosChaves(lutas);
    assert.equal(ranking.atletas.reduce((n,a)=>n+a.ouro,0),2);
    assert.equal(ranking.atletas.reduce((n,a)=>n+a.prata,0),2);
    assert.equal(new Set(ranking.atletas.map(x=>x.atleta_id)).size,100);
  });
}

