import type {FotoArquivo} from './fotos';
// A tela busca prévias e downloads pela API; não precisa dos caminhos internos.
export type FotoGaleria=Omit<FotoArquivo,'r2_original_key'|'r2_preview_key'|'r2_thumb_key'|'preview_url'|'thumb_url'>&{tem_previa:boolean;tem_miniatura:boolean};
export function resumirFotoGaleria(foto:any):FotoGaleria{
 const {r2_original_key:_original,r2_preview_key:preview,r2_thumb_key:thumb,preview_url:_url,thumb_url:_thumb,...dados}=foto;
 return {...dados,tem_previa:Boolean(foto.tem_previa??preview),tem_miniatura:Boolean(foto.tem_miniatura??thumb)};
}
