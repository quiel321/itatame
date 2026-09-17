import assert from "node:assert/strict";
import test from "node:test";
import {
  dataHoraLocalParaIso,
  dataOperacionalEvento,
  formatarDataHoraNoFuso,
  paraInputDateTimeEvento,
} from "../app/lib/evento-datas";

test("horários do evento em Cuiabá sobrevivem ao ciclo salvar, ler e exibir", () => {
  const instante = dataHoraLocalParaIso("2026-09-18T01:00", "MT");
  assert.equal(instante, "2026-09-18T05:00:00.000Z");
  assert.equal(paraInputDateTimeEvento(instante, "MT"), "2026-09-18T01:00");
  assert.equal(formatarDataHoraNoFuso(instante, false, "MT"), "18/09/2026 às 01:00");
});

test("a data do evento e o fim do dia não mudam com o fuso da máquina", () => {
  assert.equal(dataOperacionalEvento("2026-09-18", false, "MT")?.toISOString(), "2026-09-18T04:00:00.000Z");
  assert.equal(dataOperacionalEvento("2026-09-18", true, "MT")?.toISOString(), "2026-09-19T03:59:59.000Z");
  assert.equal(formatarDataHoraNoFuso("2026-09-18", false, "MT"), "18/09/2026");
});

test("o horário de São Paulo usa seu próprio fuso", () => {
  assert.equal(dataHoraLocalParaIso("2026-09-18T01:00", "SP"), "2026-09-18T04:00:00.000Z");
});
