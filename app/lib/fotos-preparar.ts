import {extensaoFoto,fotoEhRaw,fotoExigeConversao,FOTO_ORIGEM_MAX_BYTES,FOTO_QUALIDADE_JPEG,FOTO_UPLOAD_MAX_BYTES,TIPOS_FOTO_RETRATT,normalizarMidiaRetratt,validarDimensoesFoto} from './fotos-formatos';

async function abrirFoto(arquivo:File):Promise<File|ImageBitmap|ImageData>{
 if(fotoEhRaw(arquivo))return (await import('./fotos-raw')).abrirFotoRaw(arquivo);
 const ext=extensaoFoto(arquivo.name);
 try{return await createImageBitmap(arquivo);}catch{
  if(['heic','heif'].includes(ext)){
   const {default:heic2any}=await import('heic2any');
   // PNG intermediário evita uma etapa de compressão JPEG com perda.
   const resultado=await heic2any({blob:arquivo,toType:'image/png'});
   if(Array.isArray(resultado))throw Error('Selecione uma foto HEIC individual, sem sequência de imagens.');
   return createImageBitmap(resultado);
  }
  if(['tif','tiff'].includes(ext)){
   const {default:utif}=await import('utif');const buffer=await arquivo.arrayBuffer();
   const ifds=utif.decode(buffer).filter(x=>x.t256?.[0]&&x.t257?.[0]);
   const ifd=ifds.sort((a,b)=>b.t256[0]*b.t257[0]-a.t256[0]*a.t257[0])[0];
   if(!ifd)throw Error('O TIFF não contém uma foto válida.');
   validarDimensoesFoto(ifd.t256[0],ifd.t257[0]);
   if(ifds.length>1&&ifds.some(x=>x!==ifd&&x.t256[0]===ifd.t256[0]&&x.t257[0]===ifd.t257[0]))throw Error('O TIFF contém várias páginas. Exporte cada foto separadamente.');
   utif.decodeImage(buffer,ifd);
   const dados=new Uint8ClampedArray(utif.toRGBA8(ifd));
   return new ImageData(dados,ifd.width,ifd.height);
  }
  throw Error('Não foi possível ler esta foto no navegador. Exporte em JPG de alta qualidade ou tente um navegador atualizado.');
 }
}

export async function otimizarFotoParaUpload(arquivo:File){
 if(!fotoExigeConversao(arquivo)&&arquivo.size<=3*1024*1024)return {file:arquivo,otimizada:false};
 const imagem=await abrirFoto(arquivo);
 if(imagem instanceof File){
  if(imagem.size>FOTO_UPLOAD_MAX_BYTES)throw Error('A foto convertida ultrapassa 40 MB. Exporte em JPG de alta qualidade para continuar.');
  return {file:imagem,otimizada:true};
 }
 const canvas=document.createElement('canvas');
 try{
  validarDimensoesFoto(imagem.width,imagem.height);canvas.width=imagem.width;canvas.height=imagem.height;
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('Sem memória para preparar a foto. Tente pelo computador.');
  if(imagem instanceof ImageData)ctx.putImageData(imagem,0,0);else ctx.drawImage(imagem,0,0);
  // Uma codificação, sem reduzir dimensões nem percorrer várias qualidades.
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Não foi possível converter a foto na resolução original. Tente pelo computador.')),'image/jpeg',FOTO_QUALIDADE_JPEG));
  if(blob.type!=='image/jpeg')throw Error('Este navegador não conseguiu gerar a foto JPG.');
  const manter=!fotoExigeConversao(arquivo)&&arquivo.size<=blob.size;
  const file=manter?arquivo:new File([blob],`${arquivo.name.replace(/\.[^.]+$/,'')||'foto'}.jpg`,{type:'image/jpeg',lastModified:arquivo.lastModified});
  if(file.size>FOTO_UPLOAD_MAX_BYTES)throw Error('A foto convertida ultrapassa 40 MB. Exporte em JPG de alta qualidade para continuar.');
  return {file,otimizada:!manter};
 }finally{if('close' in imagem)imagem.close();canvas.width=0;canvas.height=0;}
}

async function prepararExibicao(arquivo:File,limite:number,nome:string){
 arquivo=normalizarMidiaRetratt(arquivo);
 if(!TIPOS_FOTO_RETRATT.has(arquivo.type)||!arquivo.size||arquivo.size>FOTO_ORIGEM_MAX_BYTES)throw Error('Selecione uma foto compatível de até 100 MB.');
 const imagem=await abrirFoto(arquivo);
 const bitmap=imagem instanceof File?await createImageBitmap(imagem):imagem instanceof ImageData?await createImageBitmap(imagem):imagem;
 const canvas=document.createElement('canvas');
 try{
  validarDimensoesFoto(bitmap.width,bitmap.height);
  const escala=Math.min(1,limite/Math.max(bitmap.width,bitmap.height));
  canvas.width=Math.max(1,Math.round(bitmap.width*escala));canvas.height=Math.max(1,Math.round(bitmap.height*escala));
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('Não foi possível preparar a imagem neste aparelho.');
  ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Não foi possível converter esta imagem.')),'image/jpeg',0.9));
  if(blob.type!=='image/jpeg'||blob.size>3*1024*1024)throw Error('Não foi possível preparar esta imagem abaixo de 3 MB.');
  return new File([blob],nome+'.jpg',{type:'image/jpeg',lastModified:arquivo.lastModified});
 }finally{bitmap.close();canvas.width=0;canvas.height=0;}
}
export const comprimirAvatarRetratt=(arquivo:File)=>prepararExibicao(arquivo,500,'avatar');
export const comprimirCapaRetratt=(arquivo:File)=>prepararExibicao(arquivo,1920,'capa');
