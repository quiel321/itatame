import assert from "node:assert/strict";
import test from "node:test";
import { textoAvisoChat } from "../app/lib/aviso-chat-atleta";

test("o aviso da primeira mensagem cita o campeonato e não o texto inteiro", () => {
  const texto = textoAvisoChat({ atleta: "Jeize", evento: "3º Campeonato Interno Spartan" });
  assert.match(texto.assunto, /3º Campeonato Interno Spartan/);
  assert.match(texto.corpoPush, /chat do iTatame/);
  assert.match(texto.introducao, /abriu uma conversa/);
});
