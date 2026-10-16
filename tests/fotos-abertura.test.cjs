const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function pagina(privado=false){
 const consultas=[],token='token-teste',evento={id:'galeria',nome:'Teste',status:'publicado',acesso_por_link:privado,acesso_token:token,created_by:'fotografo'};
 const db={from(tabela){let campos='';const q={select(c){campos=c;consultas.push({tabela,campos});return q;},eq(){return q;},order(){return q;},like(){return q;},range:async()=>({data:[{id:'foto',mime_type:'image/jpeg',preco_centavos:1500,r2_preview_key:'privado/preview',r2_thumb_key:'privado/thumb'}]}),then(resolve){return Promise.resolve(resolve({data:[],count:1}));}};return q;}};
 const exports={},src=ts.transpileModule(fs.readFileSync('app/fotos/evento/[id]/page.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 vm.runInNewContext(src,{exports,console,Promise,require:n=>n==='react/jsx-runtime'?require('react/jsx-runtime'):n.includes('fotos-evento-servidor')?{carregarEventoFotos:async()=>({data:evento}),carregarAutorFotos:async()=>({autor_nome:'Teste',tipo_autor:'fotografo'})}:n.includes('supabase-server')?{createSupabaseServerClient:()=>db}:n.includes('fotos-galeria')?require('../app/lib/fotos-galeria'):n.includes('fotos-acesso-album')?{acessoAlbumPermitido:(e,a)=>e.status==='publicado'&&(!e.acesso_por_link||e.acesso_token===a)}:n.includes('EventoGaleriaCliente')?{default:()=>null}:{} });
 return {abrir:acesso=>exports.default({params:Promise.resolve({id:'galeria'}),searchParams:Promise.resolve(acesso?{acesso}:{})}),consultas};
}
test('galeria restrita não consulta mídias antes de validar acesso',async()=>{
 const p=pagina(true);for(const acesso of [undefined,'errado']){const r=await p.abrir(acesso);assert.equal(r.props.initialData,undefined);assert.equal(p.consultas.length,0);}
});
test('resposta inicial mantém fotos e preços sem expor token nem carregar chaves desnecessárias',async()=>{
 for(const privado of [false,true]){const p=pagina(privado),r=await p.abrir(privado?'token-teste':undefined);assert.equal(r.props.initialData.fotos.length,1);assert.equal(r.props.initialData.fotos[0].preco_centavos,1500);assert.equal(r.props.initialData.evento.acesso_token,undefined);assert.equal(r.props.initialData.fotos[0].r2_preview_key,undefined);assert.equal(r.props.initialData.fotos[0].tem_previa,true);assert.equal(r.props.initialData.fotos[0].tem_miniatura,true);assert.equal(r.props.acesso,privado?'token-teste':null);assert.ok(p.consultas.filter(c=>c.tabela==='foto_arquivos').every(c=>!c.campos.includes('r2_original_key')));}
});
