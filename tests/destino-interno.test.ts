import assert from "node:assert/strict";
import test from "node:test";
import { destinoInterno, urlLoginComRetorno } from "../app/lib/destino-interno";

test("só aceita caminho interno e preserva a fatura no retorno do login", () => {
  assert.equal(destinoInterno("/pagamento?inscricao=abc"), "/pagamento?inscricao=abc");
  assert.equal(destinoInterno("https://evil.test/x"), "/perfil");
  assert.equal(urlLoginComRetorno("/pagamento?inscricao=abc"), "/login?redirect=%2Fpagamento%3Finscricao%3Dabc");
});
