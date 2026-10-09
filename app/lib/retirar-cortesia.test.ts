import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { retirarCortesia } from './retirar-cortesia';

function banco(pagamento = true) {
 const estado = {
  inscricao: { id: 299, evento_id: 'evento', pagamento_ok: pagamento, cupom_id: 'cupom', cupom_codigo: 'VIPSPARTAN', desconto_valor: 35, cortesia: true, valor_inscricao: 35, valor_total: 0, mp_payment_id: null as string | null },
  cupom: { id: 'cupom', evento_id: 'evento', usos_atualmente: 3 },
  falhaEstoque: false, reservaConcorrente: false, devolucoes: 0,
 };
 const db = {from(tabela: string) {
  let alteracao: any; const filtros: Array<[string,unknown]> = [];
  const q: any = {
   select() { return q; }, update(dados: any) { alteracao = dados; return q; },
   eq(campo: string, valor: unknown) { filtros.push([campo,valor]); return q; },
   is(campo: string, valor: unknown) { filtros.push([campo,valor]); return q; },
   async maybeSingle() {
    if(tabela === 'eventos') return {data: filtros.some(([k,v])=>k==='organizador_id'&&v==='organizador')?{id:'evento'}:null,error:null};
    const registro: any = tabela==='inscricoes'?estado.inscricao:estado.cupom;
    if(tabela==='cupons'&&alteracao&&estado.falhaEstoque)return {data:null,error:{message:'Falha simulada'}};
    if(tabela==='cupons'&&alteracao&&estado.reservaConcorrente){estado.cupom.usos_atualmente++;estado.reservaConcorrente=false;}
    if(!filtros.every(([k,v])=>String(registro[k])===String(v)))return {data:null,error:null};
    if(alteracao){Object.assign(registro,alteracao);if(tabela==='cupons')estado.devolucoes++;}
    return {data:{...registro},error:null};
   },
  }; return q;
 }} as unknown as SupabaseClient;
 return {db,estado};
}

test('desfazer cortesia remove cupom e devolve exatamente uma vaga', async()=>{
 const {db,estado}=banco();const r=await retirarCortesia(db,'organizador','299');
 assert.equal(r.pagamento_ok,false);assert.equal(r.cortesia,false);assert.equal(r.cupom_id,null);assert.equal(r.cupom_codigo,null);assert.equal(r.desconto_valor,0);assert.equal(r.valor_total,35);
 assert.equal(estado.cupom.usos_atualmente,2);assert.equal(estado.devolucoes,1);
 await retirarCortesia(db,'organizador','299');assert.equal(estado.cupom.usos_atualmente,2);assert.equal(estado.devolucoes,1);
});
test('corrige inscrição já pendente que ainda conservava cortesia',async()=>{
 const {db,estado}=banco(false);await retirarCortesia(db,'organizador','299');assert.equal(estado.inscricao.valor_total,35);assert.equal(estado.cupom.usos_atualmente,2);
});
test('outro organizador não pode retirar o cupom',async()=>{
 const {db,estado}=banco();await assert.rejects(retirarCortesia(db,'intruso','299'),/não autorizado/);assert.equal(estado.cupom.usos_atualmente,3);assert.equal(estado.inscricao.cortesia,true);
});
test('pagamento vinculado ao Mercado Pago é preservado',async()=>{
 const {db,estado}=banco();estado.inscricao.mp_payment_id='123';await assert.rejects(retirarCortesia(db,'organizador','299'),/sem pagamento/);assert.equal(estado.inscricao.pagamento_ok,true);assert.equal(estado.cupom.usos_atualmente,3);
});
test('reserva concorrente é preservada na devolução',async()=>{
 const {db,estado}=banco();estado.reservaConcorrente=true;await retirarCortesia(db,'organizador','299');assert.equal(estado.cupom.usos_atualmente,3);assert.equal(estado.devolucoes,1);
});
test('falha no estoque restaura cortesia para nova tentativa',async()=>{
 const {db,estado}=banco();estado.falhaEstoque=true;await assert.rejects(retirarCortesia(db,'organizador','299'),/cortesia foi preservada/);assert.equal(estado.inscricao.cupom_id,'cupom');assert.equal(estado.inscricao.pagamento_ok,true);assert.equal(estado.inscricao.valor_total,0);assert.equal(estado.cupom.usos_atualmente,3);
 estado.falhaEstoque=false;await retirarCortesia(db,'organizador','299');assert.equal(estado.cupom.usos_atualmente,2);
});
test('cliques simultâneos não devolvem duas vagas',async()=>{
 const {db,estado}=banco();const r=await Promise.allSettled([retirarCortesia(db,'organizador','299'),retirarCortesia(db,'organizador','299')]);assert.equal(r.filter(x=>x.status==='fulfilled').length,1);assert.equal(estado.cupom.usos_atualmente,2);assert.equal(estado.devolucoes,1);
});
