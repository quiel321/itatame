import test from 'node:test';
import assert from 'node:assert/strict';
import { criarAtualizacaoAoVivo } from '../app/lib/atualizacao-ao-vivo';

function barreira() {
  let liberar!: () => void;
  const promessa = new Promise<void>(resolve => { liberar = resolve; });
  return { promessa, liberar };
}

test('placar lento agrupa alterações do mesário e lê a versão mais recente sem concorrência', async () => {
  const primeira = barreira(), iniciou = barreira();
  let versao = 1, chamadas = 0, simultaneas = 0, maximo = 0;
  const exibidas: number[] = [];
  const atualizador = criarAtualizacaoAoVivo(async ativo => {
    chamadas++; simultaneas++; maximo = Math.max(maximo, simultaneas);
    const lida = versao;
    if (chamadas === 1) { iniciou.liberar(); await primeira.promessa; }
    if (ativo()) exibidas.push(lida);
    simultaneas--;
  });
  const leitura = atualizador.solicitar(); await iniciou.promessa;
  versao = 7;
  atualizador.solicitar(); atualizador.solicitar(); atualizador.solicitar();
  primeira.liberar(); await leitura;
  assert.deepEqual(exibidas, [1, 7]);
  assert.equal(chamadas, 2); assert.equal(maximo, 1);
});

test('falha de rede mantém o último placar e a consulta seguinte recupera os pontos', async () => {
  let falhar = true, pontos = 4, erros = 0;
  const atualizador = criarAtualizacaoAoVivo(async ativo => {
    if (falhar) throw Error('rede indisponível');
    if (ativo()) pontos = 9;
  }, () => { erros++; });
  await atualizador.solicitar();
  assert.equal(pontos, 4); assert.equal(erros, 1);
  falhar = false; await atualizador.solicitar();
  assert.equal(pontos, 9);
});

test('sair do evento descarta a resposta antiga e cancela consultas pendentes', async () => {
  const rede = barreira(), iniciou = barreira(); let aplicadas = 0, consultas = 0;
  const atualizador = criarAtualizacaoAoVivo(async ativo => {
    consultas++; iniciou.liberar(); await rede.promessa;
    if (ativo()) aplicadas++;
  });
  const leitura = atualizador.solicitar(); await iniciou.promessa;
  atualizador.solicitar(); atualizador.cancelar(); rede.liberar(); await leitura;
  await atualizador.solicitar();
  assert.equal(aplicadas, 0); assert.equal(consultas, 1);
});
