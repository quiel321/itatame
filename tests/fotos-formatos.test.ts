import {test} from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {ACCEPT_FOTOS_RETRATT,ACCEPT_MIDIAS_RETRATT,EXTENSOES_RAW,TIPOS_FOTO_RETRATT,normalizarMidiaRetratt,jpegTemResolucaoCompleta,dimensoesVisiveisRaw,jpegComOrientacao,pixelsRawParaRgba,validarDimensoesFoto} from '../app/lib/fotos-formatos';
import {otimizarFotoParaUpload,comprimirAvatarRetratt,comprimirCapaRetratt} from '../app/lib/fotos-preparar';

test('RAW e formatos frequentes são reconhecidos mesmo sem MIME no arquivo',()=>{
 for(const ext of [...EXTENSOES_RAW,'heic','heif','avif','tif','tiff','bmp','jpg','png','webp']){
  const f=normalizarMidiaRetratt(new File(['teste'],'FOTO.'+ext.toUpperCase(),{type:'application/octet-stream'}));
  assert.ok(TIPOS_FOTO_RETRATT.has(f.type));assert.ok(ACCEPT_FOTOS_RETRATT.includes('.'+ext));
 }
 assert.equal(normalizarMidiaRetratt(new File(['a'],'video.MOV')).type,'video/quicktime');
 assert.ok(ACCEPT_MIDIAS_RETRATT.includes('.mov'));assert.ok(!ACCEPT_FOTOS_RETRATT.includes('.mov'));
 assert.equal(TIPOS_FOTO_RETRATT.has(normalizarMidiaRetratt(new File(['x'],'a.svg')).type),false);
});
test('a prévia RAW precisa da resolução completa da foto; margens de sensor não contam',()=>{
 const meta={width:6020,height:4015,raw_inset_crops:[{cwidth:6000,cheight:3999}]};
 const visivel=dimensoesVisiveisRaw(meta);
 assert.ok(jpegTemResolucaoCompleta(6000,4000,visivel));assert.ok(jpegTemResolucaoCompleta(4000,6000,visivel));
 assert.ok(!jpegTemResolucaoCompleta(1620,1080,visivel));
 assert.deepEqual(dimensoesVisiveisRaw({width:6000,height:4000,raw_inset_crops:[{cwidth:0,cheight:0}]}),{width:6000,height:4000});
 assert.throws(()=>validarDimensoesFoto(100000,100000));assert.throws(()=>validarDimensoesFoto(0,4000));
 assert.deepEqual([...pixelsRawParaRgba({width:1,height:1,colors:3,bits:8,data:[15,25,35]})],[15,25,35,255]);
 assert.throws(()=>pixelsRawParaRgba({width:1,height:1,colors:3,bits:16,data:[1,2,3]}));
});
test('orientação do RAW é aplicada ao JPEG sem recodificar os pixels',async()=>{
 const bytes=await sharp({create:{width:4,height:2,channels:3,background:'#ff8000'}}).jpeg().toBuffer();
 const originalPixels=await sharp(bytes).raw().toBuffer();
 for(const orientation of [1,3,6,8]){
  const jpg=jpegComOrientacao(bytes,orientation);const meta=await sharp(jpg).metadata();
  assert.equal(meta.orientation,orientation);assert.equal(meta.width,4);assert.equal(meta.height,2);
  assert.deepEqual(await sharp(jpg).raw().toBuffer(),originalPixels);
  const repetida=jpegComOrientacao(jpg,orientation);assert.equal(repetida.length,jpg.length);
 }
 assert.throws(()=>jpegComOrientacao(new Uint8Array([1,2,3]),1));
});

test('foto de venda mantém pixels e usa uma codificação; capa e avatar usam seus próprios tamanhos',async()=>{
 const originais=Object.fromEntries(['document','createImageBitmap','ImageData'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 const codificacoes:any[]=[],tamanhos:any[]=[];let fechadas=0;
 class Dados{}
 Object.defineProperty(globalThis,'ImageData',{configurable:true,value:Dados});
 Object.defineProperty(globalThis,'createImageBitmap',{configurable:true,value:async()=>({width:6000,height:4000,close(){fechadas++;}})});
 Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement(){const canvas:any={width:0,height:0,getContext:()=>({drawImage(){},putImageData(){}}),toBlob(cb:any,type:string,quality:number){codificacoes.push({type,quality});tamanhos.push([canvas.width,canvas.height]);cb(new Blob([new Uint8Array(1024)],{type}));}};return canvas;}}});
 try{
  const pequena=new File(['jpg'],'pequena.jpg',{type:'image/jpeg'});assert.equal((await otimizarFotoParaUpload(pequena)).file,pequena);assert.equal(codificacoes.length,0);
  const grande=new File([new Uint8Array(4*1024*1024)],'foto.jpg',{type:'image/jpeg'});
  const foto=await otimizarFotoParaUpload(grande);assert.equal(foto.file.type,'image/jpeg');assert.deepEqual(tamanhos[0],[6000,4000]);assert.equal(codificacoes[0].quality,0.92);assert.equal(codificacoes.length,1);
  const capa=await comprimirCapaRetratt(pequena),avatar=await comprimirAvatarRetratt(pequena);
  assert.deepEqual(tamanhos.slice(1),[[1920,1280],[500,333]]);assert.equal(capa.type,'image/jpeg');assert.equal(avatar.type,'image/jpeg');assert.equal(fechadas,3);
 }finally{for(const [key,desc] of Object.entries(originais)){if(desc)Object.defineProperty(globalThis,key,desc);else Reflect.deleteProperty(globalThis,key);}}
});
