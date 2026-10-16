export function destinoGaleriaRetratt(href:string,host:string){
 const hosts=['retratt.com','www.retratt.com','retratt.com.br','www.retratt.com.br','retratt.localhost'];
 return hosts.includes(host)&&href.startsWith('/fotos/evento/')?href.slice('/fotos'.length):href;
}
