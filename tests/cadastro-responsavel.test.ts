import assert from 'node:assert/strict';
import test from 'node:test';
import { POST } from '../app/api/cadastro/route';
function req(campos: Record<string, string> = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries({ perfil:'responsavel', nome:'Maria Responsável', cpf:'52998224725', nascimento:'1985-01-01', telefone:'65999990000', email:'maria@example.test', password:'senha-teste', ...campos })) form.set(key,value);
  return new Request('http://localhost/api/cadastro',{method:'POST',body:form});
}
async function simular(opcoes: { cpfExiste?: boolean; emailExiste?: boolean; perfilExiste?: boolean; erroModo?: boolean }, verificar: (writes: { path: string; method: string; body: Record<string, unknown> }[]) => Promise<void>) {
  const originalFetch=globalThis.fetch;
  const env={NEXT_PUBLIC_SUPABASE_URL:'https://supabase.test',NEXT_PUBLIC_SUPABASE_ANON_KEY:'anon-teste',SUPABASE_SERVICE_ROLE_KEY:'service-teste',RESEND_API_KEY:'re_ficticia'};
  const original=Object.fromEntries(Object.keys(env).map(key=>[key,process.env[key]]));Object.assign(process.env,env);
  const writes: {path:string;method:string;body:Record<string,unknown>}[]=[];
  globalThis.fetch=async(input,init)=>{
    const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
    assert.ok(['https://supabase.test','https://api.resend.com'].includes(url.origin),'Sem acesso a serviços reais');
    const method=init?.method||'GET';
    if(method!=='GET') writes.push({path:url.pathname,method,body:init?.body?JSON.parse(String(init.body)):{}});
    if(url.pathname==='/auth/v1/admin/users') return opcoes.emailExiste ? Response.json({code:'email_exists',msg:'Already registered'},{status:422}) : Response.json({id:'11111111-1111-4111-8111-111111111111',email:'maria@example.test'});
    if(url.pathname==='/auth/v1/token') return Response.json({access_token:'token-ficticio',refresh_token:'refresh-ficticio',token_type:'bearer',expires_in:3600,user:{id:'11111111-1111-4111-8111-111111111111',email:'maria@example.test',user_metadata:{role:'comprador',preferencia_fotos:'preservar'}}});
    if(url.pathname==='/auth/v1/logout') return new Response(null,{status:204});
    if(url.pathname==='/auth/v1/admin/users/11111111-1111-4111-8111-111111111111') return opcoes.erroModo ? Response.json({msg:'Falha simulada'},{status:500}) : Response.json({id:'11111111-1111-4111-8111-111111111111'});
    if(url.pathname==='/rest/v1/atletas') {
      if(method==='POST') return new Response(null,{status:201});
      if(method==='DELETE') { assert.equal(url.searchParams.get('user_id'),'eq.11111111-1111-4111-8111-111111111111');return new Response(null,{status:204}); }
      if(url.searchParams.has('cpf')) return Response.json(opcoes.cpfExiste?[{cpf:'529.982.247-25'}]:[]);
      return Response.json(opcoes.perfilExiste?[{id:414}]:[]);
    }
    if(['/rest/v1/foto_compradores','/rest/v1/fotografos','/rest/v1/foto_organizadores'].includes(url.pathname))return Response.json(url.pathname.includes('foto_compradores')?[{user_id:'11111111-1111-4111-8111-111111111111'}]:[]);
    if(url.pathname==='/auth/v1/admin/generate_link')return Response.json({id:'11111111-1111-4111-8111-111111111111',email:'maria@example.test',action_link:'https://supabase.test/auth/v1/verify?token=ficticio',verification_type:'signup'});
    if(url.pathname==='/emails')return Response.json({id:'email-ficticio'});
    throw Error('Requisição inesperada: '+url.pathname);
  };
  try{await verificar(writes)}finally{globalThis.fetch=originalFetch;for(const[key,value]of Object.entries(original)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
}
test('responsável exige dados do adulto e recusa menor antes de criar conta', async()=>{
  const original=globalThis.fetch;globalThis.fetch=async()=>{throw Error('Não acessar serviços com dados inválidos')};
  const camposInvalidos: Record<string, string>[] = [{nome:''},{cpf:'123'},{nascimento:'2015-01-01'},{telefone:'123'}];
  try{for(const campos of camposInvalidos)assert.equal((await POST(req(campos))).status,400);}finally{globalThis.fetch=original;}
});
test('responsável não precisa de CT e usa conta compatível sem dados esportivos do filho', async()=>{
  await simular({},async writes=>{const resposta=await POST(req({equipe:'CT do filho',academia:'Academia do filho'}));assert.equal(resposta.status,200);assert.equal((await resposta.json()).requiresEmailConfirmation,true);
    const conta=writes.find(w=>w.path==='/auth/v1/admin/users')!.body.user_metadata as Record<string,unknown>;
    assert.equal(conta.nome,'Maria Responsável');assert.equal(conta.role,'atleta');assert.equal(conta.somente_responsavel,true);
    const perfil=writes.find(w=>w.path==='/rest/v1/atletas'&&w.method==='POST')!.body;
    assert.equal(perfil.nome,'Maria Responsável');assert.equal(perfil.role,'atleta');assert.equal(perfil.equipe,'');assert.equal(perfil.academia,'');assert.equal(perfil.professor,'');assert.equal(perfil.faixa,'');assert.equal(perfil.modalidade,'');assert.equal(perfil.responsavel_id,undefined);
  });
});
test('CPF existente orienta a acessar dependentes sem criar uma segunda conta', async()=>{
  await simular({cpfExiste:true},async writes=>{const resposta=await POST(req());assert.equal(resposta.status,409);assert.match((await resposta.json()).error,/Meus dependentes/);assert.equal(writes.length,0);});
});
test('e-mail existente preserva o perfil de atleta ou professor e não muda seus metadados', async()=>{
  await simular({emailExiste:true,perfilExiste:true},async writes=>{const resposta=await POST(req());assert.equal(resposta.status,409);assert.match((await resposta.json()).error,/Meus dependentes/);assert.ok(!writes.some(w=>w.path==='/rest/v1/atletas'||w.path==='/auth/v1/admin/users/11111111-1111-4111-8111-111111111111'));});
});
test('responsável pode usar a conta Retratt existente sem criar outro usuário', async()=>{
  await simular({emailExiste:true},async writes=>{const resposta=await POST(req());assert.equal(resposta.status,200);assert.equal((await resposta.json()).requiresEmailConfirmation,false);assert.equal(writes.filter(w=>w.path==='/rest/v1/atletas'&&w.method==='POST').length,1);assert.deepEqual(writes.find(w=>w.path==='/auth/v1/admin/users/11111111-1111-4111-8111-111111111111')!.body.user_metadata,{role:'comprador',preferencia_fotos:'preservar',somente_responsavel:true});});
});
test('falha ao preparar o modo responsável desfaz apenas o novo perfil vinculado', async()=>{
  await simular({emailExiste:true,erroModo:true},async writes=>{assert.equal((await POST(req())).status,503);assert.ok(writes.some(w=>w.path==='/rest/v1/atletas'&&w.method==='DELETE'));assert.ok(!writes.some(w=>w.path==='/auth/v1/admin/users/11111111-1111-4111-8111-111111111111'&&w.method==='DELETE'));});
});

