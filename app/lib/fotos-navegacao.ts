export function destinoGaleriaRetratt(href:string,host:string){
 const hosts=['retratt.com','www.retratt.com','retratt.com.br','www.retratt.com.br','retratt.localhost'];
 return hosts.includes(host)&&href.startsWith('/fotos/evento/')?href.slice('/fotos'.length):href;
}

// Mantém query, hash, tokens de acesso e URLs externas exatamente como recebidos.
export function destinoNavegacaoFotos(href: string, host: string) {
 const retratt = ['retratt.com', 'www.retratt.com', 'retratt.com.br', 'www.retratt.com.br', 'retratt.localhost'].includes(host);
 if (!retratt || !/^\/fotos(?:[/?#]|$)/.test(href)) return href;
 const destino = href.slice('/fotos'.length);
 return !destino || destino.startsWith('?') || destino.startsWith('#') ? `/${destino}` : destino;
}
