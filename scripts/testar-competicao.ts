import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { prepararGrupos, montarChaves } from '../app/lib/gerar-chaves';
import { grupoInscricao, categoriaCompativel, idadeCompetitiva, type CategoriaCompeticao, type InscricaoCompeticao } from '../app/lib/categorias-competicao';
import { criarChavesImpressao, tituloEventoImpressao, type LutaImpressao } from '../app/lib/chaves-impressao';
import { limiteParcelas, validarParcelas } from '../app/lib/parcelamento';
import { calcularResultadosChaves, lerRegrasPontuacao } from '../app/lib/ranking-eventos';
import { chaveRankingEquipe } from '../app/lib/equipes-nome';
import { processarAvancosAutomaticosChaves } from '../app/lib/chaves-auto-avanco';

const evento='11111111-1111-4111-8111-111111111111';
const atleta=(id:number, extras: Partial<InscricaoCompeticao> = {}):InscricaoCompeticao=>({ id,atleta_id:id,atleta:`Atleta de Teste ${id}`,equipe:`Academia ${id%3}`,categoria:'Leve',faixa:'Branca',sexo:'Masculino',idade:23,peso:70,modalidade:'Jiu-Jitsu',pagamento_ok:true,...extras });
const catPeso=(id:string, extras: Partial<CategoriaCompeticao> = {}):CategoriaCompeticao=>({
  id,evento_id:evento,nome:extras.nome || 'Leve',modalidade:'Jiu-Jitsu',sexo:extras.sexo || 'Masculino',faixa:extras.faixa || 'Branca',
  idade_min:extras.idade_min ?? 18,idade_max:extras.idade_max ?? 29,peso_min:extras.peso_min ?? 0,peso_max:extras.peso_max ?? 200,
  tempo_minutos:5,tipo:'peso',ativa:true,...extras,
});
const categoriasDivisao=[
  catPeso('adulto-m',{nome:'Adulto',idade_min:18,idade_max:29,sexo:'Masculino'}),
  catPeso('adulto-f',{nome:'Adulto',idade_min:18,idade_max:29,sexo:'Feminino'}),
  catPeso('master-m',{nome:'Master 1',idade_min:30,idade_max:35,sexo:'Masculino'}),
  catPeso('8-anos',{nome:'8 anos',idade_min:8,idade_max:8}),
  catPeso('9-anos',{nome:'9 anos',idade_min:9,idade_max:9}),
];
assert.notEqual(grupoInscricao(atleta(1,{categoria_id:'adulto-m'}),'peso',categoriasDivisao).categoria,grupoInscricao(atleta(2,{sexo:'Feminino',categoria_id:'adulto-f'}),'peso',categoriasDivisao).categoria);
assert.notEqual(grupoInscricao(atleta(1,{categoria_id:'adulto-m'}),'peso',categoriasDivisao).categoria,grupoInscricao(atleta(2,{idade:32,categoria_id:'master-m'}),'peso',categoriasDivisao).categoria);
assert.notEqual(grupoInscricao(atleta(1,{idade:8,categoria_id:'8-anos'}),'peso',categoriasDivisao).categoria,grupoInscricao(atleta(2,{idade:9,categoria_id:'9-anos'}),'peso',categoriasDivisao).categoria);
assert.equal(idadeCompetitiva('2018-09-17','2026-09-17'),8);
assert.equal(idadeCompetitiva('2018-09-18','2026-09-17'),7);
assert.equal(grupoInscricao(atleta(1,{idade:idadeCompetitiva('2018-03-01','2026-09-17'),categoria_id:'8-anos'}),'peso',categoriasDivisao).categoria.includes('8 anos'),true);
assert.throws(()=>grupoInscricao(atleta(1,{idade:null}),'peso'));
assert.throws(()=>grupoInscricao(atleta(1,{sexo:''}),'peso'));
assert.throws(()=>grupoInscricao(atleta(1),'peso'));
const categoria:CategoriaCompeticao=catPeso('cat',{nome:'Adulto Leve',peso_min:64,peso_max:76});
assert.equal(categoriaCompativel(categoria,atleta(1,{peso:76})),true);
assert.equal(categoriaCompativel(categoria,atleta(1,{peso:64})),false);
assert.equal(categoriaCompativel(categoria,atleta(1,{peso:76.1})),false);
assert.equal(categoriaCompativel(categoria,atleta(1,{sexo:'Feminino'})),false);
assert.throws(()=>grupoInscricao(atleta(1,{categoria_id:'ausente'}),'peso',[categoria]));
assert.throws(()=>grupoInscricao(atleta(1,{categoria:'Absoluto',absoluto:true}),'peso',[categoria]));
assert.throws(()=>prepararGrupos([atleta(1),atleta(1)],'peso',[categoria]));
assert.throws(()=>prepararGrupos(Array.from({length:65},(_,i)=>atleta(i+1,{categoria_id:'cat'})),'peso',[categoria]));
const exemplos:LutaImpressao[]=[];
for(const tamanho of [1,2,3,4,5,6,8,16,17,32,64]) {
  const catTamanho=catPeso(`cat-${tamanho}`,{nome:`Divisão de teste com ${tamanho} atletas`,peso_min:64,peso_max:76});
  const entradas=Array.from({length:tamanho},(_,i)=>atleta(i+1,{categoria_id:catTamanho.id}));
  const lutas=montarChaves(evento,prepararGrupos(entradas,'peso',[catTamanho]));
  const ids=new Set(lutas.flatMap(l=>[l.atleta_1_id,l.atleta_2_id]).filter(Boolean));
  assert.equal(ids.size,tamanho,`Nenhum atleta pode sumir (${tamanho})`);
  assert.equal(lutas.filter(l=>!l.proxima_luta).length,1);
  assert.equal(new Set(lutas.map(l=>l.id_visual)).size,lutas.length);
  for(const l of lutas) if(l.proxima_luta) assert(lutas.some(p=>String(p.id_visual)===String(l.proxima_luta)));
  assert.equal(lutas.length,tamanho===3?3:Math.max(2,2**Math.ceil(Math.log2(tamanho)))-1);
  if([1,3,16,64].includes(tamanho))exemplos.push(...lutas.map((l,i)=>({...l,id:`teste-${tamanho}-${i}`} as LutaImpressao)));
}
const sozinho=montarChaves(evento,prepararGrupos([atleta(99,{categoria_id:'cat'})],'peso',[categoria]));
assert.equal(sozinho.length,1);
assert.equal(sozinho[0].vencedor,null);
assert.equal(sozinho[0].status_luta,'agendada');
assert.equal(limiteParcelas(false),1);assert.equal(limiteParcelas(true),12);
assert.equal(validarParcelas('6',12),6);
for(const valor of [0,13,1.5,'abc'])assert.throws(()=>validarParcelas(valor,12));
assert.throws(()=>validarParcelas(2,1));
assert.equal(tituloEventoImpressao('Open Teste Final CJ','Cuiabá'),'Open Teste Final CJ - CUIABÁ');
assert.equal(tituloEventoImpressao('Open Sapezal','Sapezal'),'Open Sapezal');
mkdirSync('output/pdf',{recursive:true});
const pdf=criarChavesImpressao({eventoNome:'Campeonato de demonstração - dados fictícios',eventoCidade:'Cuiabá',lutas:exemplos});
assert(pdf.getNumberOfPages()>=4);
writeFileSync('output/pdf/chaves-demonstracao.pdf',Buffer.from(pdf.output('arraybuffer')));

const finalReal = calcularResultadosChaves([{
  status_luta:'concluida', fase:'Final', id_visual:'999', metodo_vitoria:'finalizacao',
  vencedor:'Ana', vencedor_id:1, atleta_1:'Ana', atleta_1_id:1, equipe_1:'A',
  atleta_2:'Bia', atleta_2_id:2, equipe_2:'B',
}]);
assert.equal(finalReal.atletas.find(a=>a.atleta_id==='1')?.ouro,1);
assert.equal(finalReal.atletas.find(a=>a.atleta_id==='2')?.prata,1);

const byeAposChecagem = calcularResultadosChaves([{
  status_luta:'concluida', fase:'Final', id_visual:'1', metodo_vitoria:'wo',
  vencedor:'Ezequiel', vencedor_id:10, atleta_1:'Ezequiel', atleta_1_id:10, equipe_1:'Legado',
  atleta_2:'BYE', atleta_2_id:null, equipe_2:'',
}]);
assert.equal(byeAposChecagem.atletas.length,1);
assert.equal(byeAposChecagem.atletas[0].ouro,1);
assert.equal(byeAposChecagem.atletas[0].vitorias_wo,1);

const ausencia = calcularResultadosChaves([{
  status_luta:'concluida', fase:'Final', id_visual:'999', metodo_vitoria:'ausencia',
  vencedor:'Ana', vencedor_id:1, atleta_1:'Ana', atleta_1_id:1, equipe_1:'A',
  atleta_2:'Bia', atleta_2_id:2, equipe_2:'B',
}]);
assert.equal(ausencia.atletas.length,0);

const byeBye = calcularResultadosChaves([{
  status_luta:'concluida', fase:'Oitavas', id_visual:'3', metodo_vitoria:'wo',
  vencedor:'BYE', vencedor_id:null, atleta_1:'BYE', atleta_1_id:null, atleta_2:'BYE', atleta_2_id:null,
}]);
assert.equal(byeBye.atletas.length,0);

const chaveDeTres = calcularResultadosChaves([
  { status_luta:'concluida', fase:'Semifinal 1 · Chave de 3', id_visual:'1', proxima_luta:999, metodo_vitoria:'pontos', vencedor:'A', vencedor_id:1, atleta_1:'A', atleta_1_id:1, atleta_2:'B', atleta_2_id:2, equipe_1:'X', equipe_2:'Y' },
  { status_luta:'concluida', fase:'Semifinal 2 · Chave de 3', id_visual:'2', proxima_luta:999, metodo_vitoria:'pontos', vencedor:'C', vencedor_id:3, atleta_1:'B', atleta_1_id:2, atleta_2:'C', atleta_2_id:3, equipe_1:'Y', equipe_2:'Z' },
  { status_luta:'concluida', fase:'Final · Chave de 3', id_visual:'999', metodo_vitoria:'pontos', vencedor:'A', vencedor_id:1, atleta_1:'A', atleta_1_id:1, atleta_2:'C', atleta_2_id:3, equipe_1:'X', equipe_2:'Z' },
]);
assert.equal(chaveDeTres.atletas.find(a=>a.atleta_id==='1')?.ouro,1);
assert.equal(chaveDeTres.atletas.find(a=>a.atleta_id==='2')?.bronze,1);
assert.equal(chaveDeTres.atletas.find(a=>a.atleta_id==='3')?.prata,1);
assert.equal(chaveDeTres.atletas.find(a=>a.atleta_id==='2')?.ouro,0);

const woAdversarioReal = calcularResultadosChaves([{
  status_luta:'concluida', fase:'Final', id_visual:'999', metodo_vitoria:'wo',
  vencedor:'Ana', vencedor_id:1, atleta_1:'Ana', atleta_1_id:1, equipe_1:'A',
  atleta_2:'Bia', atleta_2_id:2, equipe_2:'B',
}]);
assert.equal(woAdversarioReal.atletas.length,0);
assert.equal(JSON.stringify(lerRegrasPontuacao('{"ranking_publicado":true}')).includes('ranking_publicado'), true);
assert.equal(chaveRankingEquipe('LEGADO JIU'), chaveRankingEquipe('Legado'));
const equipesDuplicadas = calcularResultadosChaves([
  { status_luta:'concluida', fase:'Final', id_visual:'999', metodo_vitoria:'finalizacao', vencedor:'Ana', vencedor_id:1, atleta_1:'Ana', atleta_1_id:1, equipe_1:'LEGADO', atleta_2:'Bia', atleta_2_id:2, equipe_2:'LEGADO JIU' },
]);
assert.equal(equipesDuplicadas.equipes.length, 1);

function memoriaChaves(lutas:any[], inscricoes:any[]) {
  return {
    from(tabela:string) {
      let update:any = null;
      const cadeia:any = {
        select: () => cadeia,
        eq: (_c:string, v:any) => {
          if (update) {
            const alvo = lutas.find(l => String(l.id) === String(v));
            if (alvo) Object.assign(alvo, update);
            update = null;
            return Promise.resolve({ error: null });
          }
          return cadeia;
        },
        in: () => cadeia,
        update: (dados:any) => { update = dados; return cadeia; },
        then: (ok:any, fail:any) => Promise.resolve({
          data: tabela === 'chaves' ? lutas : inscricoes,
          error: null,
        }).then(ok, fail),
      };
      return cadeia;
    },
  };
}
const lutaSozinho = { id:'l1', evento_id:evento, categoria:'Leve', faixa:'Branca', id_visual:'1', proxima_luta:null, atleta_1:'Ezequiel', atleta_2:'BYE', atleta_1_id:10, atleta_2_id:null, status_luta:'agendada', vencedor:null, fase:'Final' };
async function conferirWoAposChecagem() {
  await processarAvancosAutomaticosChaves(memoriaChaves([lutaSozinho], [{ atleta_id:10, status_checkin:'pendente' }]), evento);
  assert.equal(lutaSozinho.status_luta,'agendada');
  await processarAvancosAutomaticosChaves(memoriaChaves([lutaSozinho], [{ atleta_id:10, status_checkin:'aprovado' }]), evento);
  assert.equal(lutaSozinho.status_luta,'concluida');
  assert.equal(lutaSozinho.vencedor,'Ezequiel');
  const sf1={ id:'t1', evento_id:evento, categoria:'ADULTOOO', faixa:'Branca', id_visual:'1', proxima_luta:999, atleta_1:'Ezequiel', atleta_2:'Aylan', atleta_1_id:1, atleta_2_id:2, status_luta:'agendada', vencedor:null, fase:'Semifinal 1 · Chave de 3' };
  const sf2={ id:'t2', evento_id:evento, categoria:'ADULTOOO', faixa:'Branca', id_visual:'2', proxima_luta:999, atleta_1:'TBD', atleta_2:'Alex', atleta_1_id:null, atleta_2_id:3, status_luta:'agendada', vencedor:null, fase:'Semifinal 2 · Chave de 3' };
  const fin={ id:'t3', evento_id:evento, categoria:'ADULTOOO', faixa:'Branca', id_visual:'999', proxima_luta:null, atleta_1:'TBD', atleta_2:'TBD', atleta_1_id:null, atleta_2_id:null, status_luta:'agendada', vencedor:null, fase:'Final · Chave de 3' };
  const inscritosTres=[{ atleta_id:1, status_checkin:'aprovado' },{ atleta_id:2, status_checkin:'aprovado' },{ atleta_id:3, status_checkin:'aprovado' }];
  await processarAvancosAutomaticosChaves(memoriaChaves([sf1,sf2,fin], inscritosTres), evento);
  assert.equal(sf1.status_luta,'agendada');
  assert.equal(sf2.status_luta,'agendada');
  assert.equal(sf2.vencedor,null);
  assert.equal(fin.status_luta,'agendada');
  const l1={ id:'s1', evento_id:evento, categoria:'Absoluto', faixa:'Preta', id_visual:'1', proxima_luta:101, atleta_1:'Aylan', atleta_2:'Alex', atleta_1_id:1, atleta_2_id:2, status_luta:'agendada', vencedor:null, fase:'Luta 1 esquerda · Chave de 3' };
  const b1={ id:'s2', evento_id:evento, categoria:'Absoluto', faixa:'Preta', id_visual:'2', proxima_luta:101, atleta_1:'TBD', atleta_2:'Ezequiel', atleta_1_id:null, atleta_2_id:3, status_luta:'agendada', vencedor:null, fase:'Baia esquerda · Chave de 3' };
  const d1={ id:'s101', evento_id:evento, categoria:'Absoluto', faixa:'Preta', id_visual:'101', proxima_luta:999, atleta_1:'TBD', atleta_2:'TBD', atleta_1_id:null, atleta_2_id:null, status_luta:'agendada', vencedor:null, fase:'Decisão esquerda · Chave de 3' };
  const l2={ id:'s3', evento_id:evento, categoria:'Absoluto', faixa:'Preta', id_visual:'3', proxima_luta:102, atleta_1:'Ruberson', atleta_2:'Jefferson', atleta_1_id:4, atleta_2_id:5, status_luta:'agendada', vencedor:null, fase:'Luta 1 direita · Chave de 3' };
  const b2={ id:'s4', evento_id:evento, categoria:'Absoluto', faixa:'Preta', id_visual:'4', proxima_luta:102, atleta_1:'TBD', atleta_2:'Nego', atleta_1_id:null, atleta_2_id:6, status_luta:'agendada', vencedor:null, fase:'Baia direita · Chave de 3' };
  const d2={ id:'s102', evento_id:evento, categoria:'Absoluto', faixa:'Preta', id_visual:'102', proxima_luta:999, atleta_1:'TBD', atleta_2:'TBD', atleta_1_id:null, atleta_2_id:null, status_luta:'agendada', vencedor:null, fase:'Decisão direita · Chave de 3' };
  const fin6={ id:'s999', evento_id:evento, categoria:'Absoluto', faixa:'Preta', id_visual:'999', proxima_luta:null, atleta_1:'TBD', atleta_2:'TBD', atleta_1_id:null, atleta_2_id:null, status_luta:'agendada', vencedor:null, fase:'Final · Chave de 6' };
  const inscritosSeis=[{ atleta_id:1, status_checkin:'aprovado' },{ atleta_id:2, status_checkin:'aprovado' },{ atleta_id:3, status_checkin:'aprovado' },{ atleta_id:4, status_checkin:'aprovado' },{ atleta_id:5, status_checkin:'aprovado' },{ atleta_id:6, status_checkin:'aprovado' }];
  await processarAvancosAutomaticosChaves(memoriaChaves([l1,b1,d1,l2,b2,d2,fin6], inscritosSeis), evento);
  assert.equal(b1.status_luta,'agendada');
  assert.equal(b2.status_luta,'agendada');
  assert.equal(b1.vencedor,null);
  assert.equal(b2.vencedor,null);
  assert.equal(fin6.status_luta,'agendada');
  console.log('OK: divisões, elegibilidade, duplicatas, 1-64 atletas, árvore, parcelamento, PDF, ranking e W.O. após checagem.');
}
conferirWoAposChecagem().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
