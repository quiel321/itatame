import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { podeAcessarPerfilFotos, resolverPerfilFotos } from '../app/lib/fotos-acesso';

function banco(tabelas: string[]) {
  const consultas: { tabela: string; chave: string; valor: string }[] = [];
  const cliente = { from(tabela: string) { return { select() { return { eq(chave: string, valor: string) {
    consultas.push({ tabela, chave, valor });
    return { async maybeSingle() { return { data: tabelas.includes(tabela) ? { id: valor } : null, error: null }; } };
  } }; } }; } } as unknown as SupabaseClient;
  return { cliente, consultas };
}
const usuario = { id: 'organizador-retratt', user_metadata: {} } as User;

test('organizador cadastrado só na Retratt consegue entrar sem alterar cadastro', async () => {
  const { cliente, consultas } = banco(['foto_organizadores']);
  assert.equal(await podeAcessarPerfilFotos(cliente, usuario, 'organizador'), true);
  assert.ok(consultas.some(q => q.tabela === 'foto_organizadores' && q.chave === 'id' && q.valor === usuario.id));
  assert.ok(consultas.every(q => q.valor === usuario.id));
});

test('perfis vêm dos cadastros; metadados não concedem acesso de organizador', async () => {
  const semCadastro = banco([]).cliente;
  assert.equal(await podeAcessarPerfilFotos(semCadastro, { ...usuario, user_metadata: { foto_perfil: 'organizador' } }, 'organizador'), false);
  assert.equal(await podeAcessarPerfilFotos(semCadastro, usuario, 'comprador'), true);
  assert.equal(await resolverPerfilFotos(banco(['organizadores']).cliente, usuario), 'organizador');
  assert.equal(await resolverPerfilFotos(banco(['fotografos']).cliente, usuario), 'fotografo');
  assert.equal(await resolverPerfilFotos(banco(['foto_compradores']).cliente, usuario), 'comprador');
  assert.equal(await podeAcessarPerfilFotos(banco(['fotografos']).cliente, usuario, 'organizador'), false);
});
