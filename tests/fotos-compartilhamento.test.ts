import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import sharp from 'sharp';
import { carregarDadosOgFotos, metadataCompartilhamentoFotos } from '../app/lib/fotos-og';
import { linkCompartilhamentoGaleria } from '../app/lib/fotos-compartilhamento';
import { GET } from '../app/api/fotos/og/route';
const eventoId='11111111-1111-4111-8111-111111111111',albumId='22222222-2222-4222-8222-222222222222';
const capa='https://supabase.test/storage/v1/object/public/eventos/capa.jpg';
const evento={id:eventoId,nome:'Galeria teste',status:'publicado',capa_url:capa,acesso_por_link:false,acesso_token:'segredo-teste'};
async function simular(opcoes:{ privado?: boolean; status?: string; album?: boolean; erroCapa?: boolean }, verificar:(capas:()=>number)=>Promise<void>){
  const originalFetch=globalThis.fetch;const env={NEXT_PUBLIC_SUPABASE_URL:'https://supabase.test',SUPABASE_SERVICE_ROLE_KEY:'ficticia'};const anteriores=Object.fromEntries(Object.keys(env).map(k=>[k,process.env[k]]));Object.assign(process.env,env);let capas=0;const buffer=await sharp({create:{width:120,height:63,channels:3,background:'#ff6914'}}).jpeg().toBuffer();
  globalThis.fetch=async(input,init)=>{const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);assert.equal(url.origin,'https://supabase.test','Sem acesso a serviços reais');assert.ok(!init?.method||init.method==='GET','Compartilhar não altera nenhum dado');
    if(url.pathname==='/rest/v1/foto_eventos'){assert.equal(url.searchParams.get('id'),`eq.${eventoId}`);return Response.json([{...evento,acesso_por_link:Boolean(opcoes.privado),status:opcoes.status||'publicado'}]);}
    if(url.pathname==='/rest/v1/foto_albuns'){assert.equal(url.searchParams.get('evento_id'),`eq.${eventoId}`);assert.equal(url.searchParams.get('status'),'eq.publicado');return Response.json(opcoes.album?[{id:albumId,titulo:'Álbum teste',capa_url:capa.replace('capa.jpg','album.jpg')}]:[]);}
    if(url.pathname.startsWith('/storage/')){capas++;assert.equal(init?.redirect,'error');return opcoes.erroCapa?new Response(null,{status:404}):new Response(buffer,{headers:{'content-type':'image/jpeg'}});}
    throw Error('Requisição inesperada '+url.pathname);
  };
  try{await verificar(()=>capas)}finally{globalThis.fetch=originalFetch;for(const[k,v]of Object.entries(anteriores)){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
}
test('link usa versão da capa e mantém álbum e acesso, removendo apenas a foto aberta',()=>{
  const url=new URL(linkCompartilhamentoGaleria(`https://retratt.com/evento/${eventoId}?album=${albumId}&acesso=segredo&foto=foto&origem=busca`,capa));assert.equal(url.searchParams.get('album'),albumId);assert.equal(url.searchParams.get('acesso'),'segredo');assert.equal(url.searchParams.get('foto'),null);assert.equal(url.searchParams.get('origem'),null);assert.ok(url.searchParams.get('capa'));assert.notEqual(linkCompartilhamentoGaleria(url.href,capa),linkCompartilhamentoGaleria(url.href,capa+'?nova=1'));
});
test('galeria pública aponta a prévia para sua própria capa e álbum usa a capa do álbum',async()=>{
  await simular({},async()=>{const meta=await metadataCompartilhamentoFotos({tipo:'evento',eventoId});const image=(meta.openGraph?.images as {url:string}[])[0].url;assert.match(image,/api\/fotos\/og\?evento=/);assert.ok(!image.includes('acesso='));assert.ok(meta.alternates?.canonical);});
  await simular({album:true},async()=>{const dados=await carregarDadosOgFotos({tipo:'evento',eventoId,albumId});assert.equal(dados?.capaUrl,capa.replace('capa.jpg','album.jpg'));assert.equal(dados?.titulo,'Álbum teste · Galeria teste');});
});
test('galeria restrita exige o token correto, permanece fora da indexação e não publica canonical com segredo',async()=>{
  await simular({privado:true},async()=>{for(const acesso of [undefined,'errado'])assert.equal(await carregarDadosOgFotos({tipo:'evento',eventoId,acesso}),null);const meta=await metadataCompartilhamentoFotos({tipo:'evento',eventoId,acesso:'segredo-teste'});assert.deepEqual(meta.robots,{index:false,follow:false});assert.equal(meta.alternates,undefined);assert.match((meta.openGraph?.images as {url:string}[])[0].url,/acesso=segredo-teste/);});
});
test('endpoint entrega capa JPEG e mantém cache público só para galerias públicas',async()=>{
  for(const privado of [false,true])await simular({privado},async()=>{const response=await GET(new NextRequest(`https://retratt.com/api/fotos/og?evento=${eventoId}${privado?'&acesso=segredo-teste':''}`));assert.equal(response.status,200);assert.equal(response.headers.get('Content-Type'),'image/jpeg');assert.equal(response.headers.get('Cache-Control')?.startsWith('private'),privado);const metadata=await sharp(Buffer.from(await response.arrayBuffer())).metadata();assert.equal(metadata.width,1200);assert.equal(metadata.height,630);});
});
test('endpoint não busca capa restrita sem autorização ou galeria não publicada',async()=>{
  await simular({privado:true},async capas=>{const r=await GET(new NextRequest(`https://retratt.com/api/fotos/og?evento=${eventoId}&acesso=errado`));assert.equal(r.status,302);assert.equal(capas(),0);});
  await simular({status:'rascunho'},async capas=>{const r=await GET(new NextRequest(`https://retratt.com/api/fotos/og?evento=${eventoId}`));assert.equal(r.status,302);assert.equal(capas(),0);});
});
test('capa indisponível retorna imagem padrão em vez de prévia quebrada',async()=>{
  await simular({erroCapa:true},async()=>{const r=await GET(new NextRequest(`https://retratt.com/api/fotos/og?evento=${eventoId}`));assert.equal(r.status,302);assert.match(r.headers.get('Location')||'',/opengraph-image/);});
});
