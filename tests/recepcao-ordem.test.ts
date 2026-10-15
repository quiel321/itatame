import test from 'node:test';
import assert from 'node:assert/strict';
import {categoriasRecepcaoOrdenadas} from '../app/lib/operacao-campeonato';
test('Recepção segue sequência salva, separa tatames e deixa categorias não distribuídas ao final',()=>{
const lista=['Adulto','Infantil','Mirim','Sem divisão'].map((categoria,id)=>({id,user_id:'fake',atleta:'fake',categoria}));
const chaves=[{categoria:'Adulto',tatame:'Tatame 1',ordem_tatame:8},{categoria:'Infantil',tatame:'Tatame 1',ordem_tatame:1},{categoria:'Mirim',tatame:'Tatame 2',ordem_tatame:1},{categoria:'Infantil',tatame:'Tatame 1',ordem_tatame:4}];
assert.deepEqual(categoriasRecepcaoOrdenadas(lista,chaves).map(c=>c.nome),['Infantil','Adulto','Mirim','Sem divisão']);
assert.deepEqual(categoriasRecepcaoOrdenadas(lista,chaves).map(c=>c.tatame),['Tatame 1','Tatame 1','Tatame 2','']);
});