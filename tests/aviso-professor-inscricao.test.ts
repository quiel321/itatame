import assert from "node:assert/strict";
import test from "node:test";
import { textoAvisoProfessor } from "../app/lib/aviso-professor-inscricao";

test("aviso do professor cita o aluno, o evento e a equipe oficial", () => {
  const texto = textoAvisoProfessor({
    professor: "Jefferson",
    atleta: "Jeize",
    evento: "3º Campeonato Interno Spartan",
    categoria: "Leve",
    equipe: "Legado Jiu-Jitsu",
    academia: "Spartan",
    pagamentoOk: false,
  });

  assert.match(texto.assunto, /3º Campeonato Interno Spartan/);
  assert.match(texto.corpoPush, /Jeize/);
  assert.match(texto.introducao, /nome oficial da equipe/);
  assert.match(texto.detalhe, /Legado Jiu-Jitsu · Spartan/);
  assert.match(texto.detalhe, /pendente/);
});
