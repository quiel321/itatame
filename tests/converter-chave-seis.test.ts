import test from 'node:test';
import assert from 'node:assert/strict';
import { converterSeisPreservandoConfrontos } from '../app/lib/converter-chave-seis';
import { processarAvancosAutomaticosChaves, propagarResultadoChave, isChaveAtletaReal } from '../app/lib/chaves-auto-avanco';
import { calcularResultadosChaves } from '../app/lib/ranking-eventos';
export function legada() {
 return ['1','2','101','3','4','102','999'].map((id,i)=>{
 const a=id==='1'?1:id==='3'?4:null,b=id==='1'?2:id==='2'?3:id==='3'?5:id==='4'?6:null;
 return {id:'luta-'+id,id_visual:id,evento_id:'ficticio',categoria_id:'cat',categoria:'FICTÍCIO',faixa:'Branca',fase:id==='999'?'Final · Chave de 6':'Teste · Chave de 3',lado:['1','2','101'].includes(id)?'esquerda':id==='999'?'centro':'direita',proxima_luta:id==='999'?null:Number(id)<3?101:Number(id)<5?102:999,atleta_1:a?'FICTÍCIO '+a:'TBD',atleta_2:b?'FICTÍCIO '+b:'TBD',atleta_1_id:a,atleta_2_id:b,equipe_1:a?'EQUIPE '+a:'',equipe_2:b?'EQUIPE '+b:'',numero_1:a?String(a):'',numero_2:b?String(b):'',status_luta:'agendada',vencedor:null,pontuacao_atleta_1:{pontos:0},pontuacao_atleta_2:{pontos:0},tatame:'AREA 2',ordem_tatame:i+1,horario_estimado:'2026-10-17T18:00:00Z'};
 });
}
test('conversão conserva confrontos iniciais, seis atletas, lados, IDs e horários',()=>{
 const antes=legada(), backup=structuredClone(antes),depois=converterSeisPreservandoConfrontos(antes);
 assert.deepEqual(antes,backup);
 for(const l of depois){const a=antes.find(x=>x.id===l.id)!;for(const k of Object.keys(a))if(!['fase',...(['2','4'].includes(l.id_visual)?['atleta_1','atleta_2','atleta_1_id','atleta_2_id','equipe_1','equipe_2','numero_1','numero_2']:[])].includes(k))assert.deepEqual((l as any)[k],(a as any)[k],k);}
 assert.equal(depois.filter(l=>l.atleta_2==='BYE').length,2);
 assert.deepEqual(depois.filter(l=>['2','4'].includes(l.id_visual)).map(l=>l.atleta_1_id),[3,6]);
 assert.equal(depois.some(l=>l.fase.includes('Chave de')),false);
});
test('conversão bloqueia resultados, presenças, chamadas, atletas repetidos e origem divergente',()=>{
 for(const patch of [{vencedor:'FICTÍCIO 1'},{iniciada_em:'2026-10-17'},{pontuacao_atleta_1:{chamador_presente:true}},{pontuacao_atleta_2:{chamador_chamadas:1}},{status_luta:'concluida'},{proxima_luta:999}]){const l=legada();Object.assign(l[0],patch);assert.throws(()=>converterSeisPreservandoConfrontos(l));}
 const l=legada();l[0].atleta_2_id=1;assert.throws(()=>converterSeisPreservandoConfrontos(l));
 assert.throws(()=>converterSeisPreservandoConfrontos(legada().slice(1)));
});
test('32 combinações de vencedores: cinco combates, sem repescagem e pódio coerente',async()=>{
 for(let mask=0;mask<32;mask++){
 const lutas:any[]=converterSeisPreservandoConfrontos(legada());let aprovado=false;
 const inscritos=Array.from({length:6},(_,i)=>({atleta_id:i+1,categoria_id:'cat',get status_checkin(){return aprovado?'aprovado':'pendente'}}));
 const db={from:(t:string)=>{
 if(t==='recepcao_categorias')return {select:()=>({eq:()=>({eq:async()=>({data:[{categoria_id:'cat'}],error:null})})})};
 assert.ok(['chaves','inscricoes'].includes(t));
 return {select:()=>({eq:()=>Object.assign(Promise.resolve({data:structuredClone(t==='chaves'?lutas:inscritos),error:null}),{in:async()=>({data:inscritos,error:null})})}),update:(payload:any)=>{const f:any[]=[];const q:any={eq:(k:string,v:any)=>{f.push((l:any)=>l[k]===v);return q},neq:(k:string,v:any)=>{f.push((l:any)=>l[k]!==v);return q},is:(k:string,v:any)=>{f.push((l:any)=>(l[k]??null)===v);return q},select:()=>q,then:(resolve:any)=>{const alvos=lutas.filter(l=>f.every(p=>p(l)));alvos.forEach(l=>Object.assign(l,payload));return Promise.resolve({data:alvos.map(l=>({id:l.id})),error:null}).then(resolve)}};return q}};
 }};
 await processarAvancosAutomaticosChaves(db,'ficticio');assert.ok(lutas.every(l=>!l.vencedor),'Sem avanço antes da aprovação');aprovado=true;
 let combates=0;
 for(let r=0;r<10;r++){
 await processarAvancosAutomaticosChaves(db,'ficticio');
 const l=lutas.find(x=>x.status_luta!=='concluida'&&isChaveAtletaReal(x.atleta_1)&&isChaveAtletaReal(x.atleta_2));if(!l)break;
 const lado=(mask>>combates)&1?2:1,outro=lado===1?2:1;
 Object.assign(l,{status_luta:'concluida',vencedor:l['atleta_'+lado],vencedor_id:l['atleta_'+lado+'_id'],metodo_vitoria:'pontos'});
 await propagarResultadoChave(db,lutas,l,{vencedorNome:l['atleta_'+lado],vencedorId:l['atleta_'+lado+'_id'],vencedorEquipe:l['equipe_'+lado],perdedorNome:l['atleta_'+outro],perdedorId:l['atleta_'+outro+'_id'],perdedorEquipe:l['equipe_'+outro]});combates++;
 }
 assert.equal(combates,5);assert.ok(lutas.every(l=>l.status_luta==='concluida'));
 const ranking=calcularResultadosChaves(lutas);assert.equal(ranking.atletas.reduce((n,a)=>n+a.ouro,0),1);assert.equal(ranking.atletas.reduce((n,a)=>n+a.prata,0),1);assert.equal(ranking.atletas.reduce((n,a)=>n+a.bronze,0),2);
 }
});
