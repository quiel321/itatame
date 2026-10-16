import { ehFaseChaveDeTres } from './chave-de-tres';
type Luta = { id_visual?:string|number|null;proxima_luta?:string|number|null;fase?:string|null;atleta_1?:string|null;atleta_2?:string|null;equipe_1?:string|null;equipe_2?:string|null;status_luta?:string|null;vencedor?:string|null };
export function resumoAvancoSemCombate(luta:Luta,todas:Luta[]) {
 if(ehFaseChaveDeTres(luta.fase)||luta.proxima_luta==null||luta.status_luta==='cancelada')return null;
 const nomes=[luta.atleta_1,luta.atleta_2].map(n=>String(n||'').trim());
 const bye=nomes.findIndex(n=>n.toUpperCase()==='BYE');
 if(bye<0)return null;
 const lado=(bye===0?2:1) as 1|2,nome=nomes[lado-1];
 if(!nome||['BYE','TBD'].includes(nome.toUpperCase())||todas.some(l=>l.proxima_luta!=null&&String(l.proxima_luta)===String(luta.id_visual)))return null;
 const destino=todas.find(l=>String(l.id_visual)===String(luta.proxima_luta));
 const fase=String(destino?.fase||'').toLowerCase();
 const titulo=fase.includes('semifinal')?'Avanço direto à semifinal':fase.startsWith('final')?'Avanço direto à final':fase.includes('quarta')?'Avanço direto às quartas de final':fase.includes('oitava')?'Avanço direto às oitavas de final':'Avanço direto à próxima fase';
 const confirmado=luta.status_luta==='concluida'&&String(luta.vencedor||'').trim().toUpperCase()===nome.toUpperCase();
 return {nome,lado,equipe:lado===1?luta.equipe_1:luta.equipe_2,titulo,confirmado};
}
