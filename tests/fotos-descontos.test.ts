import assert from "node:assert/strict";
import test from "node:test";
import { calcularDescontoFotos, faixasDoEvento, validarFaixasDesconto } from "../app/lib/fotos-descontos";

test("aplica a maior faixa atingida somente às fotos", () => {
  const faixas = validarFaixasDesconto([{ quantidade: 6, percentual: 5 }, { quantidade: 8, percentual: 10 }, { quantidade: 12, percentual: 15 }]);
  assert.ok(faixas);
  const itens = Array.from({ length: 8 }, () => ({ precoCentavos: 1000, mimeType: "image/jpeg" }));
  itens.push({ precoCentavos: 1000, mimeType: "video/mp4" });
  assert.deepEqual(calcularDescontoFotos(faixas, itens), { faixa: { quantidade: 8, percentual: 10 }, valor: 800 });
  assert.equal(calcularDescontoFotos(faixas, itens.slice(0, 5)).valor, 0);
});

test("preserva o combo antigo e permite desativar novas galerias", () => {
  assert.deepEqual(faixasDoEvento({ desconto_combo_qtd: 3, desconto_combo_percentual: 20 }), [{ quantidade: 3, percentual: 20 }]);
  assert.deepEqual(faixasDoEvento({ descontos_progressivos: [], desconto_combo_qtd: 3, desconto_combo_percentual: 20 }), []);
});

test("rejeita faixas duplicadas e desconto que não cresce", () => {
  assert.equal(validarFaixasDesconto([{ quantidade: 6, percentual: 10 }, { quantidade: 6, percentual: 15 }]), null);
  assert.equal(validarFaixasDesconto([{ quantidade: 6, percentual: 10 }, { quantidade: 8, percentual: 5 }]), null);
});
