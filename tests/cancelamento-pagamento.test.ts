import assert from "node:assert/strict";
import test from "node:test";
import { acaoParaPagamentoPendente, pagamentoPertenceAInscricao } from "../app/lib/cancelamento-pagamento";

test("pagamento pendente pode ser cancelado no provedor", () => {
  for (const status of ["pending", "in_process", "authorized"]) {
    assert.equal(acaoParaPagamentoPendente(status), "cancelar-no-provedor");
  }
});

test("pagamento já cancelado permite retomar remoção da inscrição", () => {
  for (const status of ["cancelled", "rejected"]) {
    assert.equal(acaoParaPagamentoPendente(status), "remover-inscricao");
  }
});

test("pagamentos com movimentação financeira não entram na remoção simples", () => {
  for (const status of ["approved", "refunded", "charged_back", "unknown"]) {
    assert.equal(acaoParaPagamentoPendente(status), "preservar-inscricao");
  }
});

test("referência externa deve corresponder exatamente à inscrição", () => {
  assert.equal(pagamentoPertenceAInscricao("inscricao:285", 285), true);
  assert.equal(pagamentoPertenceAInscricao("inscricao:286", 285), false);
  assert.equal(pagamentoPertenceAInscricao(null, 285), false);
});
