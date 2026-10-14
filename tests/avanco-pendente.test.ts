import test from 'node:test';
import assert from 'node:assert/strict';
import {processarAvancosAutomaticosChaves,propagarResultadoChave} from '../app/lib/chaves-auto-avanco';
test('resultado gravado antes da propagação não elimina atleta como BYE',async()=>{
const base={evento_id:'evento',categoria_id:'categoria',categoria:'Juvenil',faixa:'Azul',tatame:'AREA 1'};
const lutas:any[]=[
{...base,id:'quartas-real',id_visual:1,proxima_luta:101,atleta_1:'Alice',atleta_2:'Bob',atleta_1_id:1,atleta_2_id:2,status_luta:'concluida',vencedor:'Alice',vencedor_id:1},
{...base,id:'quartas-vazia',id_visual:2,proxima_luta:101,atleta_1:'BYE',atleta_2:'BYE',status_luta:'concluida',vencedor:'BYE'},
{...base,id:'semi',id_visual:101,proxima_luta:999,atleta_1:'TBD',atleta_2:'BYE',status_luta:'agendada'},
{...base,id:'final',id_visual:999,atleta_1:'TBD',atleta_2:'Cris',atleta_2_id:3,status_luta:'agendada'},
];
const inscritos=[{atleta_id:1,categoria_id:'categoria',status_checkin:'aprovado'},{atleta_id:3,categoria_id:'categoria',status_checkin:'aprovado'}];
const db:any={from:(t:string)=>t==='recepcao_categorias'?{select:()=>({eq:()=>({eq:async()=>({data:[{categoria_id:'categoria'}],error:null})})})}:({select:()=>({eq:()=>Object.assign(Promise.resolve({data:structuredClone(t==='chaves'?lutas:inscritos),error:null}),{in:async()=>({data:inscritos,error:null})})}),update:(p:any)=>{const fs:((l:any)=>boolean)[]=[];const q:any={eq:(c:string,v:any)=>{fs.push(l=>l[c]===v);return q;},neq:(c:string,v:any)=>{fs.push(l=>l[c]!==v);return q;},is:(c:string,v:any)=>{fs.push(l=>(l[c]??null)===v);return q;},select:()=>q,then:(resolve:any)=>{const xs=lutas.filter(l=>fs.every(f=>f(l)));xs.forEach(l=>Object.assign(l,p));return Promise.resolve({data:xs.map(l=>({id:l.id})),error:null}).then(resolve);}};return q;}})};
await processarAvancosAutomaticosChaves(db,'evento');assert.equal(lutas[2].status_luta,'agendada');assert.equal(lutas[3].atleta_1,'TBD');
await propagarResultadoChave(db,lutas,lutas[0],{vencedorNome:'Alice',vencedorId:1});
await processarAvancosAutomaticosChaves(db,'evento');assert.equal(lutas[2].vencedor,'Alice');assert.equal(lutas[3].atleta_1,'Alice');assert.equal(lutas[3].atleta_1_id,1);assert.equal(lutas[3].status_luta,'agendada');
});

