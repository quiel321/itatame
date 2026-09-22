import assert from "node:assert/strict";
import test from "node:test";
import { decidirVinculoProfessor } from "../app/lib/vincular-professor";

test("liga professor só na conta de organizador que ainda não tem perfil de atleta", () => {
  assert.equal(decidirVinculoProfessor(null, { status: "aprovado" }), "criar");
  assert.equal(decidirVinculoProfessor(null, { status: "pendente" }), "criar");
  assert.equal(decidirVinculoProfessor({ role: "professor" }, { status: "aprovado" }), "ja-professor");
  assert.equal(decidirVinculoProfessor({ role: "atleta" }, { status: "aprovado" }), "recusar");
  assert.equal(decidirVinculoProfessor({ role: "super-admin" }, null), "recusar");
  assert.equal(decidirVinculoProfessor(null, null), "recusar");
  assert.equal(decidirVinculoProfessor(null, { status: "super-admin" }), "recusar");
});
