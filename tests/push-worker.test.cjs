const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
function worker(falharImagem = false) {
  const eventos = {}, chamadas = [];
  const self = { location: { origin: 'https://itatame.test' }, addEventListener: (nome, fn) => { eventos[nome] = fn; }, registration: { showNotification: async (titulo, opcoes) => { chamadas.push({ titulo, opcoes }); if (falharImagem && opcoes.icon) throw Error('Imagem indisponível'); } } };
  vm.runInNewContext(fs.readFileSync('public/sw.js', 'utf8'), { self, URL, Date });
  return { chamadas, push: async data => { let pendente; eventos.push({ data, waitUntil: p => { pendente = p; } }); await pendente; } };
}
test('push preserva conteúdo e identificação por aviso e usa PNG para o Android', async () => {
  const w = worker(); await w.push({ json: () => ({ title: 'Chamada', body: 'Atleta teste: apresente-se', tag: 'aviso-filho-1', url: '/evento/teste/ao-vivo' }) });
  assert.equal(w.chamadas.length, 1); const n = w.chamadas[0]; assert.equal(n.opcoes.body, 'Atleta teste: apresente-se'); assert.equal(n.opcoes.tag, 'aviso-filho-1'); assert.equal(n.opcoes.icon, '/apple-icon'); assert.equal(n.opcoes.data.url, '/evento/teste/ao-vivo');
});
test('payload inválido ainda produz aviso e destinos externos não são abertos', async () => {
  const w = worker(); await w.push({ json: () => { throw Error('JSON inválido'); } }); assert.equal(w.chamadas.length, 1); assert.match(w.chamadas[0].opcoes.body, /Abra o sistema/);
  await w.push({ json: () => ({ url: 'https://outro.test/' }) }); assert.equal(w.chamadas[1].opcoes.data.url, '/perfil');
});
test('falha nas opções de exibição tenta um aviso somente com o conteúdo essencial', async () => {
  const w = worker(true); await w.push({ json: () => ({ title: 'Aviso', body: 'Conteúdo do campeonato', tag: 'mesmo-aviso' }) }); assert.equal(w.chamadas.length, 2); assert.equal(w.chamadas[1].opcoes.icon, undefined); assert.equal(w.chamadas[1].opcoes.body, 'Conteúdo do campeonato'); assert.equal(w.chamadas[1].opcoes.tag, 'mesmo-aviso');
});
