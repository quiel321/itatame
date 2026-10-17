import test from 'node:test';
import assert from 'node:assert/strict';
import { montarChaves } from '../app/lib/gerar-chaves';
import { criarKitContingenciaPDF, type OpcoesKit } from '../app/lib/kit-contingencia-pdf';
import { referenciaLutaImpressao } from '../app/lib/chaves-impressao';

export function exemploKit(tamanhos = [3, 4, 8, 16, 32]): OpcoesKit {
  let id = 0;
  const inscricoes: NonNullable<OpcoesKit['inscricoes']> = [];
  const lutas = tamanhos.flatMap((total, categoria) => {
    const atletas = Array.from({ length: total }, (_, i) => {
      const atleta_id = ++id, atleta = `ATLETA FICTICIO ${atleta_id}`;
      inscricoes.push({ id: atleta_id, atleta_id, atleta, categoria_id: `cat-${categoria}`, categoria: `CATEGORIA TESTE ${total}`, faixa: 'Branca', equipe: 'EQUIPE TESTE', pagamento_ok: true, status_checkin: 'pendente' });
      return { atleta_id, atleta, equipe_atleta: 'EQUIPE TESTE', equipe_chave: `EQUIPE ${i}` };
    });
    return montarChaves('FICTICIO', { grupos: { G: atletas }, metadados: { G: { categoria: `CATEGORIA TESTE ${total}`, categoria_id: `cat-${categoria}`, faixa: 'Branca', tempo_minutos: 5 } } }).map((l, i) => ({ ...l, id: `${categoria}-${i}`, tatame: '1', horario_estimado: '2026-10-17T12:00:00Z' }));
  });
  return { eventoNome: 'CAMPEONATO FICTICIO - EXEMPLO DE IMPRESSAO', estado: 'MT', tipoChave: 'Completo', geradoEm: new Date('2026-10-16T18:00:00Z'), lutas, inscricoes };
}

test('kit usa apenas recepção e árvores, preserva dados e pagina chaves grandes', () => {
  const opcoes = exemploKit();
  opcoes.inscricoes!.push({ id: 999, atleta: 'INSCRITO SEM CHAVE', categoria_id: 'cat-0', categoria: 'CATEGORIA TESTE 3', faixa: 'Branca', pagamento_ok: false });
  const antes = structuredClone(opcoes);
  const doc = criarKitContingenciaPDF(opcoes);
  assert.deepEqual(opcoes, antes);
  // Recepção: 1+1+1+2+4 páginas; árvores: 1+1+1+1+3.
  assert.equal(doc.getNumberOfPages(), 16);
  for (let i = 1; i <= doc.getNumberOfPages(); i++) {
    assert.ok(doc.getPageInfo(i));
  }
  assert.ok(Math.abs(doc.internal.pageSize.getWidth() - 297) < 0.01);
});

test('cada luta possui um único campo de resultado, inclusive em chaves repartidas', () => {
  for (const total of [1, 2, 3, 6, 13, 32, 64]) {
    const opcoes = exemploKit([total]);
    const doc = criarKitContingenciaPDF(opcoes);
    const texto = doc.internal.pages.flat().join('\n');
    const resultados = (doc.internal.pages as unknown as string[][]).flatMap(pagina => {
      const inicio = pagina.findIndex(comando => comando.includes('RESULTADOS NO PAPEL'));
      return inicio < 0 ? [] : pagina.slice(inicio + 1);
    }).join('\n');
    for (const luta of opcoes.lutas) {
      const referencia = referenciaLutaImpressao(luta);
      assert.equal(resultados.split(`(${referencia}) Tj`).length - 1, 1, `${total} atletas: resultado ${referencia}`);
    }
    assert.ok(!texto.includes('Central /'));
    assert.ok(!texto.includes('Coordena'));
    assert.ok(!/\bL(?:999|[1-9]0[1-9])\b/.test(texto));
  }
});

test('inscrição legada de absoluto usa a categoria e área da chave sem alterar o cadastro', () => {
  const opcoes = exemploKit([4]);
  opcoes.lutas.forEach(l => { l.categoria = 'Absoluto GP'; l.tatame = 'Área 1'; });
  opcoes.inscricoes!.forEach(i => { i.categoria = 'Absoluto'; i.categoria_id = null; });
  const antes = structuredClone(opcoes);
  const doc = criarKitContingenciaPDF(opcoes);
  const recepcao = (doc.internal.pages as unknown as string[][])[1].join('\n');
  assert.equal(doc.getNumberOfPages(), 2);
  assert.ok(recepcao.includes('Absoluto GP'));
  assert.ok(recepcao.includes('ÁREA: Área 1'));
  assert.ok(!recepcao.includes('Não definida'));
  assert.deepEqual(opcoes, antes);
});

test('cadastro sem participação em chave não recebe uma área por suposição', () => {
  const opcoes = exemploKit([2]);
  opcoes.lutas.forEach(l => { l.categoria = 'Absoluto GP'; l.tatame = 'Área 1'; });
  opcoes.inscricoes = [{ id: 9999, atleta_id: 9999, atleta: 'SEM CHAVE', categoria: 'Absoluto' }];
  const recepcao = (criarKitContingenciaPDF(opcoes).internal.pages as unknown as string[][])[1].join('\n');
  assert.ok(recepcao.includes('ÁREA: Não definida'));
  assert.ok(recepcao.includes('SEM CHAVE'));
});

test('kit funciona sem lutas e rejeita identificadores ambíguos', () => {
  const opcoes = exemploKit([]);
  assert.equal(criarKitContingenciaPDF(opcoes).getNumberOfPages(), 1);
  opcoes.lutas = [{ id: '1' }, { id: '1' }];
  assert.throws(() => criarKitContingenciaPDF(opcoes), /identificação/);
});

test('uma categoria com atletas de faixas diferentes gera uma lista e uma árvore', () => {
  const opcoes = exemploKit([4]);
  opcoes.inscricoes!.forEach((i, n) => { i.faixa = n % 2 ? 'Azul' : 'Branca'; });
  opcoes.lutas.forEach((l, n) => { l.faixa = n % 2 ? 'Azul' : 'Branca'; });
  const antes = structuredClone(opcoes);
  const doc = criarKitContingenciaPDF(opcoes);
  assert.equal(doc.getNumberOfPages(), 2);
  const recepcao = (doc.internal.pages as unknown as string[][])[1].join('\n');
  for (const inscricao of opcoes.inscricoes!) assert.ok(recepcao.includes(inscricao.atleta));
  assert.ok(recepcao.includes('Faixa Azul'));
  assert.ok(recepcao.includes('Faixa Branca'));
  assert.deepEqual(opcoes, antes);
});
