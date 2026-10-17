import assert from 'node:assert/strict';
import test from 'node:test';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const requerer = createRequire(import.meta.url), modulo = requerer('node:module'), resolver = modulo._resolveFilename;
const chaveEmailAnterior = process.env.RESEND_API_KEY;
process.env.RESEND_API_KEY = 're_fixture';
let POST: typeof import('../app/api/fotos/pagamento/webhook/route').POST;
let enviarAcesso: typeof import('../app/lib/email-fotos').enviarEmailAcessoRetratt;
try {
  modulo._resolveFilename = function(nome: string, ...args: unknown[]) { return resolver.call(this, nome === 'server-only' ? 'next/dist/compiled/server-only/empty' : nome, ...args); };
  POST = requerer('../app/api/fotos/pagamento/webhook/route').POST;
  enviarAcesso = requerer('../app/lib/email-fotos').enviarEmailAcessoRetratt;
} finally { modulo._resolveFilename = resolver; }

test('webhook assinado libera sem navegador; reentrega repara falhas sem repetir e-mail ou alterar datas', async () => {
  const original = globalThis.fetch;
  const nomes = ['NEXT_PUBLIC_SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','FOTOS_EMAIL_FROM','RETRATT_MP_WEBHOOK_SECRET'];
  const antes = Object.fromEntries(nomes.map(n => [n, process.env[n]]));
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fixture.supabase.co'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'fixture';
  process.env.FOTOS_EMAIL_FROM = 'iTatame Fotos <fotos@example.test>'; process.env.RETRATT_MP_WEBHOOK_SECRET = 'fixture-secret';
  const pedido = { id: 'pedido', status: 'pendente', total_centavos: 300, provedor_payment_id: '123', fotografo_id: null, organizador_user_id: 'org', modelo_recebimento: 'diaria_organizador', comprador_email: 'cliente@example.test', comprador_nome: 'Cliente QA', email_confirmacao_enviado_em: null as string | null, pago_em: null as string | null };
  let liberado = false, expira: string | null = null, falharItens = true, emails = 0, falhaBanco = false, falhaEmail = false;
  const remetentes: string[] = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input)), metodo = init?.method || 'GET';
    const corpo = init?.body ? JSON.parse(String(init.body)) : {};
    if (url.hostname === 'fixture.supabase.co') {
      if (url.pathname === '/rest/v1/foto_pedidos') {
        if (metodo === 'GET') return falhaBanco ? Response.json({message:'Banco indisponível'}, {status:500}) : Response.json(pedido);
        if (corpo.email_confirmacao_enviado_em) {
          assert.equal(url.searchParams.get('status'), 'eq.pago');
          if (pedido.email_confirmacao_enviado_em) return Response.json(null);
          pedido.email_confirmacao_enviado_em = corpo.email_confirmacao_enviado_em;
          return Response.json({...pedido, foto_eventos:{nome:'Galeria QA'},foto_pedido_itens:[{id:'item'}]});
        }
        if (corpo.email_confirmacao_enviado_em === null) pedido.email_confirmacao_enviado_em = null;
        if (corpo.status === 'pago') { assert.equal(url.searchParams.get('status'),'neq.pago'); if(pedido.status !== 'pago')Object.assign(pedido,corpo); }
        return new Response(null,{status:204});
      }
      if (url.pathname === '/rest/v1/foto_mp_organizadores') return Response.json({mp_access_token:'privado-fixture',mp_public_key:'pk-fixture'});
      if (url.pathname === '/rest/v1/foto_pedido_itens') {
        assert.equal(url.searchParams.get('download_liberado'),'eq.false');
        if (falharItens) {falharItens=false;return Response.json({message:'Falha transitória simulada'}, {status:500});}
        if (!liberado) {liberado=true; expira=corpo.download_expires_at;}
        return new Response(null,{status:204});
      }
      if (url.pathname === '/rest/v1/foto_royalties_organizador') return new Response(null,{status:204});
      if (url.pathname === '/auth/v1/admin/generate_link') return Response.json({action_link:'https://fixture.test',hashed_token:'hash-fixture',email_otp:'123456',verification_type:'magiclink',redirect_to:'https://fixture.test',id:'cliente',email:'cliente@example.test'});
    }
    if (url.hostname === 'api.mercadopago.com' && metodo === 'GET') return Response.json({id:123,status:'approved',status_detail:'accredited',external_reference:'foto_pedido:pedido',transaction_amount:3});
    if (url.hostname === 'api.resend.com' && metodo === 'POST' && url.pathname === '/emails') {
      if(falhaEmail)return Response.json({message:'Falha de e-mail simulada',name:'application_error'}, {status:500});
      emails++;remetentes.push(corpo.from);return Response.json({id:'email-'+emails});
    }
    throw Error('Rede não simulada: '+metodo+' '+url.hostname+url.pathname);
  };
  const notificacao = (alterada = false) => {
    const ts=String(Math.floor(Date.now()/1000));
    const hash=crypto.createHmac('sha256','fixture-secret').update(`id:123;request-id:req;ts:${ts};`).digest('hex');
    return new Request('https://retratt.test/api/fotos/pagamento/webhook?pedido_id=pedido&data.id=123', {method:'POST',headers:{'Content-Type':'application/json','x-request-id':'req','x-signature':`ts=${ts},v1=${alterada ? '0'.repeat(64) : hash}`},body:JSON.stringify({type:'payment',data:{id:'123'}})});
  };
  try {
    assert.equal((await POST(notificacao(true))).status,401);assert.equal(pedido.status,'pendente');
    assert.equal((await POST(notificacao())).status,500);assert.equal(pedido.status,'pago');assert.equal(emails,0);
    const pagoEm=pedido.pago_em;
    falhaEmail=true;assert.equal((await POST(notificacao())).status,503);assert.equal(liberado,true);assert.equal(pedido.email_confirmacao_enviado_em,null);
    const validade=expira;falhaEmail=false;
    assert.equal((await POST(notificacao())).status,200);assert.equal(emails,1);
    assert.equal((await POST(notificacao())).status,200);assert.equal(emails,1);assert.equal(pedido.pago_em,pagoEm);assert.equal(expira,validade);
    falhaBanco=true;assert.equal((await POST(notificacao())).status,500);falhaBanco=false;
    await enviarAcesso({email:'cliente@example.test',codigo:'123456',link:'https://retratt.test/acesso'});
    assert.deepEqual(remetentes,['Retratt <fotos@example.test>','Retratt <fotos@example.test>']);
  } finally {
    globalThis.fetch=original;for(const nome of nomes){if(antes[nome]===undefined)delete process.env[nome];else process.env[nome]=antes[nome];}
    if(chaveEmailAnterior===undefined)delete process.env.RESEND_API_KEY;else process.env.RESEND_API_KEY=chaveEmailAnterior;
  }
});
