export const FOTO_UPLOAD_MAX_BYTES=40*1024*1024;
export const FOTO_ORIGEM_MAX_BYTES=100*1024*1024;
export const FOTO_MAX_PIXELS=60_000_000;
export const FOTO_QUALIDADE_JPEG=0.92;
export const EXTENSOES_RAW=['cr2','cr3','crw','nef','nrw','arw','sr2','srf','raf','orf','rw2','pef','dng','srw'] as const;
const fotos:Record<string,string>={jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',heic:'image/heic',heif:'image/heif',avif:'image/avif',tif:'image/tiff',tiff:'image/tiff',bmp:'image/bmp',...Object.fromEntries(EXTENSOES_RAW.map(ext=>[ext,`image/x-${ext}`]))};
const videos:Record<string,string>={mp4:'video/mp4',m4v:'video/mp4',webm:'video/webm',mov:'video/quicktime',qt:'video/quicktime'};
export const TIPOS_FOTO_RETRATT=new Set(Object.values(fotos));
export const ACCEPT_FOTOS_RETRATT=[...TIPOS_FOTO_RETRATT,...Object.keys(fotos).map(ext=>'.'+ext)].join(',');
export const ACCEPT_MIDIAS_RETRATT=[...new Set([...Object.values(fotos),...Object.values(videos)]),...Object.keys({...fotos,...videos}).map(ext=>'.'+ext)].join(',');
export function extensaoFoto(nome:string){return nome.split('.').pop()?.toLowerCase()||'';}
export function fotoEhRaw(arquivo:Pick<File,'name'>){return (EXTENSOES_RAW as readonly string[]).includes(extensaoFoto(arquivo.name));}
export function fotoExigeConversao(arquivo:Pick<File,'name'|'type'>){return fotoEhRaw(arquivo)||!['image/jpeg','image/png','image/webp'].includes(arquivo.type);}
export function normalizarMidiaRetratt(arquivo:File){
 const tipo=fotos[extensaoFoto(arquivo.name)]||videos[extensaoFoto(arquivo.name)];
 if(!tipo||arquivo.type===tipo)return arquivo;
 return new File([arquivo],arquivo.name,{type:tipo,lastModified:arquivo.lastModified});
}
export function validarDimensoesFoto(width:number,height:number){
 if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<=0||height<=0||width*height>FOTO_MAX_PIXELS)throw Error('A foto ultrapassa o limite de 60 megapixels ou está danificada. Exporte uma versão JPG de alta qualidade.');
}
export function jpegTemResolucaoCompleta(width:number,height:number,meta:{width:number;height:number}){
 return Math.max(width,height)>=Math.max(meta.width,meta.height)&&Math.min(width,height)>=Math.min(meta.width,meta.height);
}
export function dimensoesVisiveisRaw(meta:{width:number;height:number;raw_inset_crops?:{cwidth:number;cheight:number}[]}){
 // LibRaw pode incluir pixels das margens do sensor fora da foto da câmera.
 const crop=meta.raw_inset_crops?.[0];
 if(crop&&crop.cwidth>0&&crop.cheight>0&&crop.cwidth<=meta.width&&crop.cheight<=meta.height)return {width:crop.cwidth,height:crop.cheight};
 return {width:meta.width,height:meta.height};
}
// O JPEG embutido nem sempre traz a orientação do RAW. Acrescenta o EXIF mínimo
// sem recodificar pixels; substitui EXIF anterior para não deixar duas orientações.
export function jpegComOrientacao(bytes:Uint8Array,orientacao:number){
 if(bytes[0]!==255||bytes[1]!==216||![1,3,6,8].includes(orientacao))throw Error('Prévia JPEG inválida.');
 const exif=new Uint8Array([255,225,0,34,69,120,105,102,0,0,73,73,42,0,8,0,0,0,1,0,18,1,3,0,1,0,0,0,orientacao,0,0,0,0,0,0,0]);
 const partes:Uint8Array[]=[bytes.subarray(0,2),exif];let p=2;
 while(p+4<=bytes.length&&bytes[p]===255){
  const marker=bytes[p+1];if(marker===218||marker===217)break;
  const tamanho=(bytes[p+2]<<8)+bytes[p+3];if(tamanho<2||p+2+tamanho>bytes.length)throw Error('Prévia JPEG incompleta.');
  const antigo=marker===225&&bytes[p+4]===69&&bytes[p+5]===120&&bytes[p+6]===105&&bytes[p+7]===102&&bytes[p+8]===0&&bytes[p+9]===0;
  if(!antigo)partes.push(bytes.subarray(p,p+2+tamanho));p+=2+tamanho;
 }
 partes.push(bytes.subarray(p));const saida=new Uint8Array(partes.reduce((n,x)=>n+x.length,0));let offset=0;
 for(const parte of partes){saida.set(parte,offset);offset+=parte.length;}return saida;
}
export function pixelsRawParaRgba(d:{width:number;height:number;colors:number;bits:number;data:ArrayLike<number>}){
 validarDimensoesFoto(d.width,d.height);
 if(d.bits!==8||![1,3,4].includes(d.colors)||d.data.length!==d.width*d.height*d.colors)throw Error('A câmera retornou uma imagem RAW incompatível. Exporte em JPG e tente novamente.');
 const rgba=new Uint8ClampedArray(d.width*d.height*4);
 for(let p=0,q=0;p<d.data.length;p+=d.colors,q+=4){rgba[q]=d.data[p];rgba[q+1]=d.data[p+(d.colors===1?0:1)];rgba[q+2]=d.data[p+(d.colors===1?0:2)];rgba[q+3]=255;}
 return rgba;
}
