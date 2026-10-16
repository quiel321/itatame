import { createHash } from 'node:crypto';
export type AssinaturaPush = {endpoint:string;keys:{p256dh:string;auth:string};expirationTime?:number|null};
export function assinaturaPushValida(raw:unknown):AssinaturaPush|null {
 try {const p=typeof raw==='string'?JSON.parse(raw):raw as any;const u=new URL(p?.endpoint);const host=u.hostname;
 if(u.protocol!=='https:'||u.username||u.password||u.port||!(host==='fcm.googleapis.com'||host==='fcmregistrations.googleapis.com'||host==='updates.push.services.mozilla.com'||host.endsWith('.push.services.mozilla.com')||host==='web.push.apple.com'||host.endsWith('.notify.windows.com')))return null;
 if(Buffer.from(p.keys?.p256dh||'','base64url').length!==65||Buffer.from(p.keys?.auth||'','base64url').length!==16||(p.expirationTime&&p.expirationTime<=Date.now()))return null;return p;
 }catch{return null;}
}
export function destinosPush(atleta:{user_id?:string|null;responsavel_id?:string|null}) {return [...new Set([atleta.user_id,atleta.responsavel_id].filter((x):x is string=>Boolean(x)))];}
export function assinaturasUnicas(rows:{subscription:unknown}[]) {const mapa=new Map<string,AssinaturaPush>();for(const r of rows){const p=assinaturaPushValida(r.subscription);if(p)mapa.set(p.endpoint,p);}return [...mapa.values()];}
export const hashPush=(s:string)=>createHash('sha256').update(s).digest('hex');
export function proximaTentativa(tentativas:number,agora=new Date()) {return new Date(agora.getTime()+Math.min(300,15*2**Math.max(0,tentativas-1))*1000).toISOString();}
export function textoProgramacao(nome:string,categoria:string,tatame:string,horario:string,fuso:string) {
 const h=new Date(horario).toLocaleString('pt-BR',{timeZone:fuso,day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
 return `${nome}: ${categoria}. ${tatame}, previsão ${h}. Horário estimado; acompanhe o painel ao vivo.`;
}
