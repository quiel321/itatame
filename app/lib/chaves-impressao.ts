import { jsPDF } from 'jspdf';
import { obterTempoRegulamentar } from './cronograma';
import type { LutaKitContingencia } from './kit-contingencia-pdf';
import { rotuloLuta } from './lutas-rotulos';

export type LutaImpressao = LutaKitContingencia & { numero_1?: string; numero_2?: string; atleta_1_id?: number|null; atleta_2_id?: number|null; tempo_minutos?: number|null };
type No = { luta?: LutaImpressao; nome?: string; equipe?: string; filhos?: No[]; pagina?: number };
const limpo = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim();
const real = (v: unknown) => v && !['BYE','TBD'].includes(limpo(v).toUpperCase());
export const chaveGrupoPDF = (l: LutaImpressao) => JSON.stringify([l.categoria || '',l.faixa || '']);

/** Imprime a árvore real, inclusive BYEs. Grandes chaves são repartidas com referências entre páginas. */
export function criarChavesImpressao({eventoNome,lutas}: {eventoNome:string;lutas:LutaImpressao[]}) {
  if (!lutas.length) throw new Error('Nenhuma chave para imprimir.');
  const doc = new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
  const grupos = new Map<string,LutaImpressao[]>();
  for(const l of lutas) { const k=chaveGrupoPDF(l);grupos.set(k,[...(grupos.get(k)||[]),l]); }
  let folhas=0;
  function texto(s:string,x:number,y:number,w:number,size=8,maxLines=2) {
    doc.setFontSize(size);const linhas=doc.splitTextToSize(s,w) as string[];
    if(linhas.length>maxLines) {linhas.length=maxLines;linhas[maxLines-1]=linhas[maxLines-1].slice(0,-3)+'...';}
    doc.text(linhas,x,y);
  }
  for(const grupo of grupos.values()) {
    const base=grupo[0];
    const atletas=new Set(grupo.flatMap(l=>[l.atleta_1_id || (real(l.atleta_1)?l.atleta_1:null),l.atleta_2_id || (real(l.atleta_2)?l.atleta_2:null)]).filter(Boolean));
    function pagina(titulo:string) {
      if(folhas++)doc.addPage();
      doc.setTextColor(20);doc.setDrawColor(100);doc.setLineWidth(0.25);
      doc.setFont('helvetica','bold');doc.setFontSize(18);doc.text('iTATAME',12,13);
      texto(eventoNome,57,12,225,11,2);
      doc.setFont('helvetica','normal');texto(`${base.categoria} | Faixa ${base.faixa}`,12,26,272,10,2);
      texto(`${titulo} | ${atletas.size} atleta(s) | Tempo: ${base.tempo_minutos || obterTempoRegulamentar(base.categoria||'',base.faixa||'')} min | Área: ${base.tatame || '________'} | Horário: ${base.horario_estimado ? new Date(base.horario_estimado).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}) : '____:____'}`,12,38,272,8,1);
      doc.line(12,42,285,42);
      doc.setFontSize(8);doc.text('RESULTADO FINAL',12,165);
      ['1º','2º','3º','3º'].forEach((pos,i)=>{doc.text(`${pos} __________________________`,12+i*69,173);doc.text('Equipe: ______________________',12+i*69,181);});
      doc.text('Pesagem [ ]   Premiação [ ]   Resultado registrado [ ]',12,192);
      doc.text('Coordenador: __________________   Entrega: ____:____   Devolução: ____:____',115,192);
      doc.setFontSize(6.5);doc.text(`Referência: ${base.id || 'prévia'} | BYE = sem adversário; TBD = aguarda resultado anterior.`,12,202);
      doc.text(`Página ${doc.getNumberOfPages()}`,285,202,{align:'right'});
      return doc.getNumberOfPages();
    }
    // A chave de três é um fluxo com repescagem, não uma árvore de eliminação simples.
    if(grupo.some(l=>String(l.fase).includes('Chave de 3'))) {
      pagina('Chave de 3 atletas');
      const ordenadas=[...grupo].sort((a,b)=>Number(a.id_visual)-Number(b.id_visual));
      ordenadas.forEach((l,i)=>{
        const x=12+i*93;doc.rect(x,59,87,73);
        doc.setFont('helvetica','bold');texto(rotuloLuta(l),x+4,67,79,9);
        doc.setFont('helvetica','normal');
        texto(real(l.atleta_1)?`${l.atleta_1} / ${l.equipe_1||''}`:i===1?'Perdedor da luta 1':'Vencedor da luta 1',x+4,81,79,9);
        texto(real(l.atleta_2)?`${l.atleta_2} / ${l.equipe_2||''}`:i===2?'Vencedor da luta 2':'A definir',x+4,101,79,9);
        texto(`Vencedor: ${l.vencedor || '________________'}`,x+4,122,79,8);
      });
      texto('Luta 1: vencedor vai à final; perdedor enfrenta o terceiro atleta na luta 2. O vencedor da luta 2 completa a final.',12,147,273,9);
      continue;
    }
    const porId=new Map(grupo.map(l=>[String(l.id_visual),l]));
    const finais=grupo.filter(l=>!l.proxima_luta);
    if(finais.length!==1)throw new Error(`Categoria ${base.categoria}: final ausente ou duplicada. Confira a chave.`);
    function montar(l:LutaImpressao,caminho:Set<string>):No {
      const id=String(l.id_visual);
      if(caminho.has(id))throw new Error('Chave com dependência circular.');
      const proximo=new Set([...caminho,id]);
      const alimentadoras=grupo.filter(a=>String(a.proxima_luta)===id);
      const filhos=[1,2].map(lado=>{
        const origem=alimentadoras.find(a=>Number(a.id_visual)%2===(lado===1?1:0));
        if(origem)return montar(origem,proximo);
        return {nome:limpo(lado===1?l.atleta_1:l.atleta_2)||'TBD',equipe:limpo(lado===1?l.equipe_1:l.equipe_2)};
      });
      return {luta:l,filhos};
    }
    if(porId.size!==grupo.length)throw new Error('IDs de luta repetidos na categoria.');
    const raiz=montar(finais[0],new Set());
    const folhasNo=(n:No):number=>n.filhos?n.filhos.reduce((s,f)=>s+folhasNo(f),0):1;
    const profundidade=(n:No):number=>n.filhos?1+Math.max(...n.filhos.map(profundidade)):0;
    function imprimir(n:No):number {
      if(folhasNo(n)>16) {
        n={...n,filhos:n.filhos!.map(f=>({nome:`Vencedor da ${rotuloLuta(f.luta || {})}`,pagina:imprimir(f)}))};
      }
      const p=pagina(n.luta?.proxima_luta?`Seção até ${rotuloLuta(n.luta)}`:'Chave / fase final');
      const niveis=profundidade(n);const total=folhasNo(n);let indice=0;
      const largura=273/(niveis+1);
      function desenhar(no:No):{x:number;y:number} {
        const nivel=profundidade(no),x=12+nivel*largura;
        if(!no.filhos) {
          const y=50+(indice++ +0.5)*106/total;
          doc.setFont('helvetica','normal');texto(no.nome||'TBD',x,y-1,largura-4,total>8?6.8:8,1);
          texto(no.pagina?`Origem: página ${no.pagina}`:no.equipe||'',x,y+1.5,largura-4,6,1);
          doc.line(x,y+3,x+largura-3,y+3);return{x:x+largura-3,y:y+3};
        }
        const filhos=no.filhos.map(desenhar);const y=(filhos[0].y+filhos[1].y)/2;
        for(const f of filhos){doc.line(f.x,f.y,x-1,f.y);doc.line(x-1,f.y,x-1,y);}
        doc.line(x-1,y,x+largura-4,y);
        texto(`${rotuloLuta(no.luta || {})}: ${no.luta?.vencedor || '________________'}`,x+1,y-2,largura-5,7,2);
        return{x:x+largura-4,y};
      }
      desenhar(n);return p;
    }
    imprimir(raiz);
  }
  return doc;
}
