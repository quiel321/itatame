import assert from "node:assert/strict";
import test from "node:test";
import {
  inscricoesDoOrganizador,
  resumirItatame,
  situacaoInscricao,
  taxaComissao,
  valorInscricao,
  type EventoPainel,
  type InscricaoPainel,
} from "../app/lib/super-admin-painel";

test("separa pago, pendente e estorno e aplica a comissão do plano", () => {
  const resumo = resumirItatame([
    { valor: 100, situacao: "pago", taxaPercentual: 5 },
    { valor: 200, situacao: "pago", taxaPercentual: 10 },
    { valor: 40, situacao: "pendente", taxaPercentual: 5 },
    { valor: 80, situacao: "estornado", taxaPercentual: 10 },
  ]);

  assert.equal(resumo.faturamento, 300);
  assert.equal(resumo.comissao, 25);
  assert.equal(resumo.repasse, 275);
  assert.equal(resumo.pendente, 40);
  assert.equal(resumo.estornado, 80);
  assert.equal(resumo.pagos, 2);
  assert.equal(resumo.pendentes, 1);
  assert.equal(resumo.estornos, 1);
});

test("estorno não entra no faturamento mesmo com pagamento marcado", () => {
  assert.equal(situacaoInscricao({ pagamento_ok: true, estorno_status: "estornado" }), "estornado");
  assert.equal(valorInscricao({ pagamento_ok: true, estorno_status: "estornado", estorno_valor: 90, valor_total: 120 }), 90);
  assert.equal(valorInscricao({ valor_total: 0, valor_inscricao: 70 }), 70);
});

test("usa a comissão gravada no organizador antes do padrão do plano", () => {
  assert.equal(taxaComissao({ plano_comercial: "essencial", comissao_percentual: 10 }), 10);
  assert.equal(taxaComissao({ plano_comercial: "completo", comissao_percentual: null }), 10);
  assert.equal(taxaComissao(null), 5);
});

test("inscrições de um organizador não misturam com as de outro", () => {
  const eventos: EventoPainel[] = [
    { id: 1, nome: "Copa A", data_evento: null, data_fim_inscricoes: null, organizador_id: "org-a", cidade: null, estado: null, local: null },
    { id: 2, nome: "Copa B", data_evento: null, data_fim_inscricoes: null, organizador_id: "org-b", cidade: null, estado: null, local: null },
  ];
  const inscricoes: InscricaoPainel[] = [
    { id: 10, evento_id: 1, atleta: "Ana" },
    { id: 11, evento_id: 2, atleta: "Bruno" },
    { id: 12, evento_id: 9, atleta: "Caio", eventos: { organizador_id: "org-a", nome: "Extra" } },
  ];

  const daOrgA = inscricoesDoOrganizador("org-a", eventos, inscricoes).map((item) => item.atleta);
  assert.deepEqual(daOrgA, ["Ana", "Caio"]);
});
