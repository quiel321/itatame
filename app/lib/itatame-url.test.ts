import assert from "node:assert/strict";
import test from "node:test";
import { obterBaseUrlItatame } from "./itatame-url";

test("notificações usam o domínio direto mesmo com www configurado", () => {
  const anterior = process.env.NEXT_PUBLIC_BASE_URL;
  try {
    process.env.NEXT_PUBLIC_BASE_URL = "https://www.itatame.com.br/";
    assert.equal(obterBaseUrlItatame(new Request("https://www.itatame.com.br/api")), "https://itatame.com.br");
    process.env.NEXT_PUBLIC_BASE_URL = "https://itatame.com.br";
    assert.equal(obterBaseUrlItatame(new Request("https://www.itatame.com.br/api")), "https://itatame.com.br");
    delete process.env.NEXT_PUBLIC_BASE_URL;
    assert.equal(obterBaseUrlItatame(new Request("http://localhost:3000/api")), "http://localhost:3000");
    process.env.NEXT_PUBLIC_BASE_URL = "https://preview.example.com/";
    assert.equal(obterBaseUrlItatame(new Request("http://localhost:3000/api")), "https://preview.example.com");
  } finally {
    if (anterior === undefined) delete process.env.NEXT_PUBLIC_BASE_URL;
    else process.env.NEXT_PUBLIC_BASE_URL = anterior;
  }
});
