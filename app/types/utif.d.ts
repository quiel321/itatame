declare module 'utif' {
 type IFD={width:number;height:number;data?:Uint8Array;[tag:string]:any};
 const UTIF:{decode(buffer:ArrayBuffer):IFD[];decodeImage(buffer:ArrayBuffer,ifd:IFD):void;toRGBA8(ifd:IFD):Uint8Array};
 export default UTIF;
}
