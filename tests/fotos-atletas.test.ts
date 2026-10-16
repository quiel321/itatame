import assert from 'node:assert/strict';
import test from 'node:test';
import { fotoAtletaPorIdentidade } from '../app/lib/fotos-atletas';

test('busca foto pelo id mesmo com nomes iguais e mantém atleta sem foto', () => {
  const fotos = [{ id: 1, nome: 'João', foto_url: '/um.webp' }, { id: 2, nome: 'João', foto_url: '/dois.webp' }, { id: 3, nome: 'João', foto_url: null }];
  assert.equal(fotoAtletaPorIdentidade(fotos, 2), '/dois.webp');
  assert.equal(fotoAtletaPorIdentidade(fotos, 3, 'João'), null);
  assert.equal(fotoAtletaPorIdentidade(fotos, null, 'João'), null);
});

test('legados aceitam nome completo inequívoco, sem emprestar foto por trecho de nome', () => {
  const fotos = [{ id: 1234, nome: 'João Orlando', foto_url: '/joao.webp' }];
  assert.equal(fotoAtletaPorIdentidade(fotos, null, ' JOAO  ORLANDO '), '/joao.webp');
  assert.equal(fotoAtletaPorIdentidade(fotos, null, 'João'), null);
});
