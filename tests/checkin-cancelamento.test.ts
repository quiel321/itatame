import assert from 'node:assert/strict';
import test from 'node:test';
import { conferirCancelamentoInscricao } from '../app/lib/cancelamento-inscricao';
import { salvarCheckinInscricoes } from '../app/lib/checkin-inscricoes';

test('atleta e responsável só cancelam até o prazo do evento, sem chaves', async t => {
  let agora = Date.parse('2026-10-14T03:59:59.999Z');
  t.mock.method(Date, 'now', () => agora);
  let chaves = 0;
  let prazo = '2026-10-13';
  const db = { from(tabela: string) {
    const consulta = { select() { return consulta; }, eq() { return consulta; },
      maybeSingle() { return Promise.resolve({ data: tabela === 'atletas' ? { responsavel_id: 'pai' } : { data_fim_inscricoes: prazo, estado: 'MT' }, error: null }); },
      then(resolve: (value: unknown) => unknown) { return Promise.resolve({ count: chaves, error: null }).then(resolve); } };
    return consulta;
  } };
  const inscricao = { user_id: 'filho', evento_id: 'evento' };
  for (const usuario of ['filho', 'pai']) {
    assert.equal(await conferirCancelamentoInscricao(db as never, usuario, inscricao), null);
    agora = Date.parse('2026-10-14T04:00:00Z');
    assert.match(String(await conferirCancelamentoInscricao(db as never, usuario, inscricao)), /prazo.*terminou/i);
    agora = Date.parse('2026-10-14T03:59:59.999Z');
  }
  chaves = 1;
  assert.match(String(await conferirCancelamentoInscricao(db as never, 'pai', inscricao)), /chaves.*geradas/i);
  chaves = 0;
  prazo = '2026-10-14T03:59:00+00:00';
  agora = Date.parse(prazo);
  assert.equal(await conferirCancelamentoInscricao(db as never, 'pai', inscricao), null);
  agora++;
  assert.match(String(await conferirCancelamentoInscricao(db as never, 'pai', inscricao)), /prazo.*terminou/i);
});

test('QR antigo não grava check-in após cancelamento, estorno ou perda da confirmação', async () => {
  const cenarios = [
    { pagamento_ok: false, estorno_status: 'estornado', existe: true, libera: false },
    { pagamento_ok: true, estorno_status: 'estornado', existe: true, libera: false },
    { pagamento_ok: false, estorno_status: null, existe: true, libera: false },
    { pagamento_ok: true, estorno_status: null, existe: false, libera: false },
    { pagamento_ok: true, estorno_status: null, existe: true, libera: true },
  ];
  for (const estado of cenarios) {
    const filtros = new Map<string, unknown>();
    let gravacoes = 0;
    const db = { from() {
      const consulta = { update() { return consulta; }, eq(campo: string, valor: unknown) { filtros.set(campo, valor); return consulta; },
        or(filtro: string) { assert.equal(filtro, 'estorno_status.is.null,estorno_status.neq.estornado'); return consulta; },
        select() {
          assert.equal(filtros.get('evento_id'), 'evento');
          assert.equal(filtros.get('user_id'), 'filho');
          assert.equal(filtros.get('pagamento_ok'), true);
          const aceita = estado.existe && estado.pagamento_ok && estado.estorno_status !== 'estornado';
          if (aceita) gravacoes++;
          return Promise.resolve({ data: aceita ? [{ id: 1 }] : [], error: null });
        } };
      return consulta;
    } };
    const salvar = () => salvarCheckinInscricoes(db as never, 'evento', 'filho', { status_checkin: 'aprovado', pesagem_ok: true });
    if (estado.libera) assert.equal(await salvar(), 1);
    else await assert.rejects(salvar(), /Check-in bloqueado/);
    assert.equal(gravacoes, estado.libera ? 1 : 0);
  }
});
