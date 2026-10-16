import LibRaw from 'libraw-wasm-nothread';
import {dimensoesVisiveisRaw,jpegComOrientacao,jpegTemResolucaoCompleta,pixelsRawParaRgba,validarDimensoesFoto} from './fotos-formatos';

export async function abrirFotoRaw(arquivo:File):Promise<File|ImageData>{
 const raw=new LibRaw();let timer:ReturnType<typeof setTimeout>|undefined;
 const worker=(raw as unknown as {worker:Worker}).worker;let falhar:(event:Event)=>void=()=>{};
 const falha=new Promise<never>((_,reject)=>{
  falhar=()=>reject(Error('Não foi possível iniciar o conversor RAW. Atualize a página e tente novamente.'));
  worker.addEventListener('error',falhar);worker.addEventListener('messageerror',falhar);
  timer=setTimeout(()=>reject(Error('A conversão demorou demais neste aparelho. Tente pelo computador ou exporte a foto em JPG.')),90000);
 });
 try{
  return await Promise.race([falha,(async()=>{
   await raw.open(new Uint8Array(await arquivo.arrayBuffer()),{halfSize:false,useCameraWb:true,outputColor:1,outputBps:8,userQual:3});
   const meta=await raw.metadata(true);if(!meta)throw Error('Não foi possível ler os dados da câmera.');
   validarDimensoesFoto(meta.width,meta.height);
   const visivel=dimensoesVisiveisRaw(meta);
   // A prévia JPEG da câmera pode ser a foto completa. Evita demosaico e outra
   // compressão quando mantém todos os pixels; miniaturas menores são rejeitadas.
   const orientacao=({0:1,3:3,5:8,6:6} as Record<number,number>)[meta.flip];
   // O enum thumb_format da metadata varia entre builds. O formato definitivo
   // é confirmado pelo resultado de thumbnailData e pela leitura real do JPEG.
   if(orientacao&&jpegTemResolucaoCompleta(meta.thumb_width,meta.thumb_height,visivel)){
    try{
     const jpg=await raw.thumbnailData();
     if(jpg?.format==='jpeg'){
      const file=new File([jpegComOrientacao(jpg.data,orientacao)],`${arquivo.name.replace(/\.[^.]+$/,'')}.jpg`,{type:'image/jpeg',lastModified:arquivo.lastModified});
      const bitmap=await createImageBitmap(file);
      const completa=jpegTemResolucaoCompleta(bitmap.width,bitmap.height,visivel);bitmap.close();
      if(completa)return file;
     }
    }catch{/* O sensor completo continua disponível se a prévia falhar. */}
   }
   const imagem=await raw.imageData();if(!imagem)throw Error('Não foi possível converter a foto desta câmera.');
   return new ImageData(pixelsRawParaRgba(imagem),imagem.width,imagem.height);
  })()]);
 }finally{if(timer)clearTimeout(timer);worker.removeEventListener('error',falhar);worker.removeEventListener('messageerror',falhar);raw.dispose();}
}
