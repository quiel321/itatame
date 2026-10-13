import assert from 'node:assert/strict';
import test from 'node:test';
import { categoriaPermitidaAoOrganizador } from '../app/lib/ajuste-categoria-organizador';
import { categoriaCompativel, grupoInscricao, type CategoriaCompeticao } from '../app/lib/categorias-competicao';
import { PATCH } from '../app/api/organizador/inscricoes/categoria/route';
const categoria: CategoriaCompeticao = { id: 'masculina', evento_id: 'evento', nome: 'Infantil', modalidade: 'Jiu-Jitsu', sexo: 'Masculino', faixa: 'Branca', idade_min: 9, idade_max: 10, peso_min: 0, peso_max: 37, tempo_minutos: 3, tipo: 'peso', ativa: true };
const inscricao = { id: 1, evento_id: 'evento', categoria_id: 'feminina', categoria: 'Infantil Feminino', idade: 10, peso: '32', sexo: 'Feminino', faixa: 'Branca', modalidade: 'Jiu-Jitsu', absoluto: false, atleta: 'Atleta fictícia' };
test('outro sexo exige exceção; inscrição normal continua incompatível e chaves seguem categoria oficial escolhida', () => {
  assert.equal(categoriaPermitidaAoOrganizador(categoria, inscricao), false);
  assert.equal(categoriaPermitidaAoOrganizador(categoria, inscricao, true), true);
  assert.equal(categoriaCompativel(categoria, inscricao), false);
  assert.equal(categoriaPermitidaAoOrganizador({ ...categoria, modalidade: 'Judô' }, inscricao, true), false);
  assert.equal(categoriaPermitidaAoOrganizador({ ...categoria, tipo: 'absoluto' }, inscricao, true), false);
  assert.equal(categoriaPermitidaAoOrganizador(categoria, { ...inscricao, sexo: '' }, true), false);
  assert.equal(grupoInscricao({ ...inscricao, categoria_id: categoria.id }, 'peso', [categoria]).categoria_id, categoria.id);
});
test('API exige organizador, duas confirmações e ausência de chaves; não altera sexo, perfil ou pagamento', async () => {
 const original=globalThis.fetch;
 const env={url:process.env.NEXT_PUBLIC_SUPABASE_URL,key:process.env.SUPABASE_SERVICE_ROLE_KEY};
 process.env.NEXT_PUBLIC_SUPABASE_URL='https://supabase.test';process.env.SUPABASE_SERVICE_ROLE_KEY='ficticia';
 let chaves=0,autorizado=true;const writes:Record<string,unknown>[]=[];
 globalThis.fetch=async(input,init)=>{
  const u=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
  assert.equal(u.origin,'https://supabase.test');
  if(u.pathname==='/auth/v1/user')return Response.json({id:'organizador',is_anonymous:false});
  if(u.pathname==='/rest/v1/eventos'){assert.equal(u.searchParams.get('organizador_id'),'eq.organizador');return Response.json(autorizado?[{id:'evento'}]:[]);}
  if(u.pathname==='/rest/v1/categorias_evento')return Response.json([categoria]);
  if(u.pathname==='/rest/v1/chaves')return new Response(null,{status:200,headers:{'content-range':`0-0/${chaves}`}});
  assert.equal(u.pathname,'/rest/v1/inscricoes','Não consultar nem alterar cadastros de atletas');
  if(init?.method==='PATCH'){const payload=JSON.parse(String(init.body));writes.push(payload);return Response.json([{...inscricao,...payload}]);}
  return Response.json([inscricao]);
 };
 const req=(dados:Record<string,unknown>)=>new Request('http://localhost/api/organizador/inscricoes/categoria',{method:'PATCH',headers:{Authorization:'Bearer ficticio','Content-Type':'application/json'},body:JSON.stringify({inscricaoId:1,categoriaId:categoria.id,motivo:'Sozinha na chave; pai autorizou.',...dados})});
 try{
  for(const dados of [{},{permitirOutroSexo:true},{permitirOutroSexo:'true',autorizacaoConfirmada:true}])assert.equal((await PATCH(req(dados))).status,400);
  assert.equal(writes.length,0);
  const confirma={permitirOutroSexo:true,autorizacaoConfirmada:true};
  autorizado=false;assert.equal((await PATCH(req(confirma))).status,403);autorizado=true;
  chaves=1;assert.equal((await PATCH(req(confirma))).status,409);chaves=0;
  assert.equal((await PATCH(req(confirma))).status,200);
  assert.equal(writes.length,1);assert.equal(writes[0].categoria_id,'masculina');
  assert.match(String(writes[0].categoria_ajuste_motivo),/^Exceção de sexo autorizada: Feminino -> Masculino\./);
  for(const campo of ['sexo','idade','peso','faixa','pagamento_ok','valor_total','user_id'])assert.equal(campo in writes[0],false);
 }finally{globalThis.fetch=original;if(env.url===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_URL;else process.env.NEXT_PUBLIC_SUPABASE_URL=env.url;if(env.key===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=env.key;}
});
