import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { GET, POST } from '../app/api/fotos/upload-url/route';

test('consulta prévia e upload preservam credenciamento, álbum e autoria sem rede real', async () => {
  const fetchAntes = globalThis.fetch;
  const nomes = ['NEXT_PUBLIC_SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','R2_ENDPOINT','R2_BUCKET_NAME','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY'];
  const envAntes = nomes.map(n => process.env[n]);
  Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'ficticia',R2_ENDPOINT:'https://storage.example.test',R2_BUCKET_NAME:'ficticio',R2_ACCESS_KEY_ID:'ficticia',R2_SECRET_ACCESS_KEY:'ficticia' });
  let ativo = true, credenciado = true, albumPrivado = false, albumOutraGaleria = false, falhaBanco = false, sessao = true, freelance = false;
  const gravacoes: any[] = [];
  globalThis.fetch = async (input, init) => {
    const u = new URL(String(input)), metodo = init?.method || 'GET';
    assert.equal(u.hostname,'fixture.supabase.co','Todo acesso externo deve estar simulado');
    if(u.pathname==='/auth/v1/user') return sessao ? Response.json({id:'usuario',email:'fixture@example.test'}) : Response.json({message:'Sessão inválida'}, {status:401});
    if(u.pathname==='/rest/v1/fotografos') return Response.json(u.searchParams.has('id') ? {id:'outro'} : {id:'autor',user_id:'usuario',status:ativo?'ativo':'inativo'});
    if(u.pathname==='/rest/v1/foto_eventos') return falhaBanco ? Response.json({message:'Falha simulada'}, {status:500}) : Response.json({id:'galeria',status:'publicado',organizador_user_id:freelance?null:'organizador',created_by:freelance?'dono':'organizador',preco_bloqueado:true,preco_padrao_centavos:999});
    if(u.pathname==='/rest/v1/foto_evento_fotografos') return Response.json(credenciado?{id:'vinculo'}:null);
    if(u.pathname==='/rest/v1/foto_albuns') {
      assert.equal(u.searchParams.get('evento_id'),'eq.galeria');
      return Response.json(albumOutraGaleria?null:{id:'album',fotografo_id:albumPrivado?'outro':null,status:'publicado'});
    }
    if(u.pathname==='/rest/v1/foto_arquivos'&&metodo==='POST'){gravacoes.push(JSON.parse(String(init?.body)));return new Response(null,{status:201});}
    throw Error('Chamada não simulada: '+metodo+' '+u.pathname);
  };
  const get=(token=true)=>new Request('https://retratt.test/api/fotos/upload-url?eventoId=galeria&albumId=album',{headers:token?{Authorization:'Bearer fixture'}:{}});
  const post=()=>new Request('https://retratt.test/api/fotos/upload-url',{method:'POST',headers:{Authorization:'Bearer fixture','Content-Type':'application/json'},body:JSON.stringify({eventoId:'galeria',albumId:'album',fileName:'foto.jpg',contentType:'image/jpeg',size:1024,precoCentavos:1,fotografoId:'outro'})});
  try {
    assert.equal((await GET(get(false))).status,401);
    const permitido=await GET(get());assert.equal(permitido.status,200);assert.equal((await permitido.json()).autorizado,true);assert.equal(permitido.headers.get('Cache-Control'),'no-store');assert.equal(gravacoes.length,0);
    assert.equal((await POST(post())).status,200);assert.equal(gravacoes.length,1);assert.equal(gravacoes[0].fotografo_id,'autor');assert.equal(gravacoes[0].preco_centavos,999);
    albumPrivado=true;assert.equal((await GET(get())).status,403);assert.equal((await POST(post())).status,403);assert.equal(gravacoes.length,1);
    freelance=true;assert.equal((await GET(get())).status,200);freelance=false;albumPrivado=false;
    credenciado=false;assert.equal((await GET(get())).status,403);assert.equal((await POST(post())).status,403);credenciado=true;
    ativo=false;assert.equal((await GET(get())).status,403);ativo=true;
    albumOutraGaleria=true;assert.equal((await GET(get())).status,404);albumOutraGaleria=false;
    falhaBanco=true;assert.equal((await GET(get())).status,503);falhaBanco=false;
    sessao=false;assert.equal((await GET(get())).status,401);assert.equal(gravacoes.length,1);
  } finally { globalThis.fetch=fetchAntes;nomes.forEach((n,i)=>{if(envAntes[i]===undefined)delete process.env[n];else process.env[n]=envAntes[i];}); }
});

test('lote de 477 arquivos: proibição antes da preparação, interrupção e retomada sem perder a fila', async () => {
  const source=fs.readFileSync('app/fotos/fotografo/painel/page.tsx','utf8');
  const ast=ts.createSourceFile('painel.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  let trecho='';function visitar(n:ts.Node){if(ts.isFunctionDeclaration(n)&&n.name?.text==='enviarFotos')trecho=n.getText(ast);else ts.forEachChild(n,visitar);}visitar(ast);assert.ok(trecho);
  const js=ts.transpileModule(trecho,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  const arquivos=Array.from({length:477},(_,i)=>({name:`foto-${i}.jpg`,type:'image/jpeg'}));
  let permitido=false,revogado=false,preparadas=0,fila=arquivos,mensagem='',estado='',chamadasPrevia=0;
  const c:any={arquivos,eventoId:'galeria',URLSearchParams,AbortSignal,tokenDaSessao:async()=>'fixture',CONCORRENCIA_UPLOAD:4,arquivoEhVideo:()=>false,fileInputRef:{current:null},fracaoDaEtapa:()=>0,
    setStatus:(v:string)=>{estado=v;},setMensagem:(v:string)=>{mensagem=v;},setArquivos:(v:any)=>{fila=v;},setFracaoEmAndamento:()=>{},setUploadTotal:()=>{},setUploadConcluidas:()=>{},setUploadAtual:()=>{},
    fetch:async()=>{chamadasPrevia++;return Response.json(permitido?{autorizado:true}:{error:'Álbum não autorizado'},{status:permitido?200:403});},
    enviarUmaFoto:async()=>{preparadas++;if(revogado)throw Object.assign(Error('Acesso removido'),{bloqueioDeAcesso:true});},
  };
  vm.createContext(c);vm.runInContext(js,c);
  await c.enviarFotos('album');assert.equal(preparadas,0);assert.equal(fila.length,477);assert.equal(estado,'erro');assert.match(mensagem,/Envio não iniciado/);
  permitido=true;revogado=true;await c.enviarFotos('album');assert.ok(preparadas<=4);assert.equal(fila.length,477);assert.match(mensagem,/477 ficaram na fila/);
  revogado=false;preparadas=0;await c.enviarFotos('album');assert.equal(preparadas,477);assert.equal(fila.length,0);assert.equal(estado,'ok');assert.equal(chamadasPrevia,3,'Uma consulta por lote, antes das fotos');
});
