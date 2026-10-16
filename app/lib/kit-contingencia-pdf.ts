import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fusoHorarioEvento } from './evento-datas';
import { idBaiaDaPrimeiraChaveDeTres } from './chave-de-tres';
export type LutaKitContingencia = {
  id?:string|number|null;categoria?:string|null;categoria_id?:string|null;faixa?:string|null;fase?:string|null;
  id_visual?:string|number|null;proxima_luta?:string|number|null;tatame?:string|null;ordem?:number|null;ordem_tatame?:number|null;
  horario_estimado?:string|null;atleta_1?:string|null;atleta_2?:string|null;atleta_1_id?:number|null;atleta_2_id?:number|null;
  equipe_1?:string|null;equipe_2?:string|null;vencedor?:string|null;status_luta?:string|null;metodo_vitoria?:string|null;
  pontuacao_atleta_1?:any;pontuacao_atleta_2?:any;
};
export type InscricaoKit = {id:number;atleta:string;atleta_id?:number|null;categoria_id?:string|null;categoria?:string|null;faixa?:string|null;equipe?:string|null;pagamento_ok?:boolean|null;status_checkin?:string|null;peso_aferido?:number|null;pesagem_ok?:boolean|null;kimono_aprovado?:boolean|null};
type CategoriaKit = {id:string;nome?:string;peso_min?:number|null;peso_max?:number|null;tipo?:string|null};
export type OpcoesKit = {eventoNome:string;eventoId?:string;estado?:string|null;tipoChave:string;lutas:LutaKitContingencia[];inscricoes?:InscricaoKit[];categorias?:CategoriaKit[];geradoEm?:Date};
const t=(v:unknown,f='-')=>String(v??'').trim()||f;
const concluida=(l:LutaKitContingencia)=>l.status_luta==='concluida'||Boolean(l.vencedor);
const grupo=(l:LutaKitContingencia)=>`${t(l.categoria)} / ${t(l.faixa)}`;
const real=(v:unknown)=>!['','BYE','TBD','SEM OPONENTE'].includes(t(v,'').toUpperCase());
const pontos=(p:any)=>`${p?.pontos??0} P / ${p?.vantagens??0} V / ${p?.punicoes??0} PN`;
function metodo(l:LutaKitContingencia){const m=l.pontuacao_atleta_1?.metodo_sumula;return m||((l.pontuacao_atleta_1?.decisao_arbitro||l.pontuacao_atleta_2?.decisao_arbitro)?'Decisão do árbitro':t(l.metodo_vitoria));}
export function criarKitContingenciaPDF(o:OpcoesKit){
 const doc=new jsPDF({unit:'mm',format:'a4',compress:true});
 const quando=o.geradoEm||new Date();const fuso=fusoHorarioEvento(o.estado);
 const edicao=quando.toLocaleString('pt-BR',{timeZone:fuso,hour12:false});
 const hora=(v?:string|null)=>v?new Date(v).toLocaleTimeString('pt-BR',{timeZone:fuso,hour:'2-digit',minute:'2-digit'}):'--:--';
 const lutas=[...o.lutas].sort((a,b)=>t(a.tatame,'ZZZ').localeCompare(t(b.tatame,'ZZZ'),'pt-BR',{numeric:true})||Number(a.ordem_tatame??99999)-Number(b.ordem_tatame??99999)||grupo(a).localeCompare(grupo(b),'pt-BR')||Number(a.ordem??a.id_visual??0)-Number(b.ordem??b.id_visual??0));
 if(lutas.some(l=>!l.id)||new Set(lutas.map(l=>String(l.id))).size!==lutas.length)throw Error('Confira a identificação das lutas antes de imprimir.');
 const codigos=new Map(lutas.map((l,n)=>[String(l.id),`L${String(n+1).padStart(4,'0')}`]));
 const codigo=(l:LutaKitContingencia)=>codigos.get(String(l.id))||'-';
 const mesma=(a:LutaKitContingencia,b:LutaKitContingencia)=>a.categoria_id&&b.categoria_id?a.categoria_id===b.categoria_id:grupo(a)===grupo(b);
 const destino=(l:LutaKitContingencia)=>lutas.find(c=>mesma(c,l)&&String(c.id_visual)===String(l.proxima_luta));
 const nome=(l:LutaKitContingencia,lado:1|2)=>{
   const n=lado===1?l.atleta_1:l.atleta_2;if(real(n))return t(n);
   const origem=lutas.find(c=>mesma(c,l)&&(String(c.proxima_luta)===String(l.id_visual)&&(Number(c.id_visual)%2?1:2)===lado||idBaiaDaPrimeiraChaveDeTres(c.id_visual,c.fase)===String(l.id_visual)&&lado===1));
   if(!origem)return 'A definir no papel: ___________________';
   return `${idBaiaDaPrimeiraChaveDeTres(origem.id_visual,origem.fase)===String(l.id_visual)?'Perdedor':'Vencedor'} de ${codigo(origem)}: ___________________`;
 };
 let secaoAtual='',subAtual='';const secoes:{titulo:string;inicio:number}[]=[];
 function titulo(s:string,sub=''){secaoAtual=s;subAtual=sub;doc.setTextColor(20);doc.setFont('helvetica','bold');doc.setFontSize(14);doc.text(s,14,40);if(sub){doc.setFont('helvetica','normal');doc.setFontSize(8);doc.text(doc.splitTextToSize(sub,182),14,46);} }
 function pagina(s:string,sub=''){doc.addPage();titulo(s,sub);secoes.push({titulo:s,inicio:doc.getNumberOfPages()});}
 function tabela(head:string[],body:(string|number)[][],widths?:number[],start=55){autoTable(doc,{startY:start,head:[head],body,theme:'grid',styles:{font:'helvetica',fontSize:8,cellPadding:2.5,valign:'middle',overflow:'linebreak',minCellHeight:13},headStyles:{fillColor:[40,40,40],textColor:255,fontStyle:'bold'},alternateRowStyles:{fillColor:[247,247,247]},margin:{top:55,bottom:17,left:14,right:14},showHead:'everyPage',rowPageBreak:'avoid',didDrawPage:d=>{if(d.pageNumber>1)titulo(secaoAtual,subAtual);},columnStyles:widths?Object.fromEntries(widths.map((w,n)=>[n,{cellWidth:w}])):undefined});}
 titulo('Kit offline completo do campeonato','Uso impresso: recepção, chamada, mesários e central de conferência.');
 doc.setFontSize(13);doc.setFont('helvetica','bold');doc.text(doc.splitTextToSize(o.eventoNome,182),14,61);
 doc.setFont('helvetica','normal');doc.setFontSize(8.5);
 doc.text(`Evento: ${t(o.eventoId)}\nEdição: ${edicao} (${fuso})\n${lutas.length} confrontos / ${lutas.filter(concluida).length} já concluídos na emissão.`,14,80);
 const semProgramacao=lutas.filter(l=>!l.tatame||!l.ordem_tatame||!l.horario_estimado).length;
 if(semProgramacao){doc.setFont('helvetica','bold');doc.setFontSize(7.5);doc.text(`ATENÇÃO: ${semProgramacao} confronto(s) sem programação completa. Conferir antes da impressão definitiva.`,14,96);doc.setFont('helvetica','normal');doc.setFontSize(8.5);}
 const instrucoes=[
  'ANTES: imprimir novamente após fechar inscrições, revisar chaves, distribuir tatames e salvar horários. Conferir esta edição e separar as folhas por posto.',
  'INÍCIO DA QUEDA: o organizador registra o horário e autoriza a operação no papel. Conferir a luta em andamento e anotar seu placar e tempo. Parar lançamentos paralelos do mesmo confronto.',
  'RECEPÇÃO: conferir documento sem copiar número; anotar peso, kimono/faixa, aprovação ou motivo, chamadas e ausências. Categoria e decisões excepcionais são do organizador.',
  'CHAMADOR: receber apenas atletas liberados. Registrar a presença de cada lado e as três chamadas com horários. Confirmar ausências; não inventar vencedor ou pular confronto anterior.',
  'MESÁRIO: AZUL = atleta 1; VERMELHO = atleta 2, iguais ao placar. Preencher pontos, vantagens, punições, vencedor, método, horário e assinaturas. Usar cronômetro independente durante queda prolongada.',
  'CHAVES: conferir a referência do confronto e avançar no papel. Em chaves de 3 e de 6, o perdedor da primeira luta de cada lado vai à baia indicada. Não avançar automaticamente alguém reprovado.',
  'RETORNO: o organizador interrompe a duplicidade entre papel e telas; confere pendências nos aparelhos, pesagens e despachos primeiro. Depois registra as súmulas na ordem das dependências da chave.',
  'CONFERÊNCIA: em “Lançar resultados da súmula”, selecionar evento, categoria, atletas e luta. Informar placar, vencedor, método e referência. Se já confirmado, apenas conferir. Divergências exigem revisão; não sobrescrever por suposição.',
  'ARQUIVO: guardar os originais assinados com o organizador. Não limpar o navegador com ações pendentes. O PDF é uma fotografia da emissão e não é atualizado automaticamente.'
 ];
 let y=103;for(let n=0;n<instrucoes.length;n++){const linhas=doc.splitTextToSize(`${n+1}. ${instrucoes[n]}`,182);doc.text(linhas,14,y);y+=linhas.length*4+4;}
 pagina('Coordenação da contingência','Preencher na abertura e no encerramento. Uma pessoa centraliza a retomada.');
 tabela(['Controle','Registro'],[
 ['Responsável / contato de apoio','____________________________________________'],['Início no papel (data/hora)','____________________________________________'],['Retorno da conexão (data/hora)','____________________________________________'],['Lutas já concluídas na emissão',String(lutas.filter(concluida).length)],['Lutas concluídas no papel','________  / Súmulas recebidas: ________'],['Pesagens novas / divergentes','________  / Despachos a conferir: ________'],['Resultados já salvos / lançados agora','________ / ________'],['Pendências / responsável / prazo','____________________________________________'],['Conferência final por duas pessoas','____________________________________________'],['Liberação da operação digital (hora)','____________________________________________']],[65,117]);
 // Lista real de inscrições, incluindo atletas que ainda não aparecem nas chaves.
 const inscritos:InscricaoKit[]=o.inscricoes??lutas.flatMap(l=>[1,2].filter(lado=>real(lado===1?l.atleta_1:l.atleta_2)).map(lado=>({id:lado===1?l.atleta_1_id||0:l.atleta_2_id||0,atleta:t(lado===1?l.atleta_1:l.atleta_2),categoria:l.categoria,faixa:l.faixa,equipe:lado===1?l.equipe_1:l.equipe_2,categoria_id:l.categoria_id,pagamento_ok:true})));
 const unicos=[...new Map(inscritos.map(i=>[`${i.id}|${i.categoria_id??i.categoria}`,i])).values()];
 for(const cat of [...new Set(unicos.map(i=>`${i.categoria||'-'} / ${i.faixa||'-'}`))].sort((a,b)=>a.localeCompare(b,'pt-BR'))){
  const lista=unicos.filter(i=>`${i.categoria||'-'} / ${i.faixa||'-'}`===cat).sort((a,b)=>a.atleta.localeCompare(b.atleta,'pt-BR'));
  const c=o.categorias?.find(c=>c.id===lista[0]?.categoria_id);
  const limite=c?.tipo==='absoluto'?'Absoluto: sem limite de peso':c?`Limites: acima de ${c.peso_min??0} kg${c.peso_max!=null?` até ${c.peso_max} kg`:'; sem máximo'}`:'Confira os limites e regulamento com o organizador.';
  pagina('Recepção / pesagem',`${cat}. ${limite}`);
  tabela(['Inscrição / atleta','Equipe / situação na emissão','Documento / kimono','Peso / decisão no papel','Ausência / responsável'],lista.map(i=>[
   `#${i.id} / atleta #${i.atleta_id??'-'}\n${i.atleta}`,
   `${t(i.equipe)}\n${i.pagamento_ok?'Pagamento confirmado':'PENDENTE: não liberar'}\n${t(i.status_checkin,'pendente')}${i.peso_aferido!=null?` / ${i.peso_aferido} kg`:''}`,
   'Doc. [ ]\nKimono/faixa [ ]',
   '______ kg\n[ ] Apto [ ] Reprovado\nMotivo: ______________',
   '1ª __:__ 2ª __:__\n3ª __:__ Ausente [ ]\nRubrica: __________'
  ]),[45,38,25,39,35]);
 }
 if(!unicos.length){pagina('Recepção / pesagem','Sem inscrições disponíveis na emissão. O organizador deve conferir antes de usar.');tabela(['Inscrição / atleta','Categoria','Peso / kimono','Decisão / responsável'],Array.from({length:8},()=>['________________','________________','_____ kg / [ ]','________________']));}
 for(const tatame of [...new Set(lutas.map(l=>t(l.tatame,'SEM TATAME DEFINIDO')))]){
  const lista=lutas.filter(l=>t(l.tatame,'SEM TATAME DEFINIDO')===tatame);
  pagina(`Chamada / ${tatame}`,'Azul = atleta 1. Vermelho = atleta 2. Conferir pesagem, presença e liberação antes do envio.');
  tabela(['Código / ordem / hora','Categoria / atletas','Presença','Chamadas (horários)','Envio / responsável'],lista.map(l=>[
   `${codigo(l)}\nOrdem ${l.ordem_tatame??'-'} / ${hora(l.horario_estimado)}`,
   `${grupo(l)}\nAZ 1: ${nome(l,1)}\nVM 2: ${nome(l,2)}`,
   concluida(l)?'Já concluída':'AZ [ ]\nVM [ ]',
   concluida(l)?'-':'AZ 1ª __:__ 2ª __:__ 3ª __:__\nVM 1ª __:__ 2ª __:__ 3ª __:__',
   concluida(l)?`Já salva\n${t(l.vencedor)}`:'Tatame: ______\nEnvio: __:__\nRubrica: ______'
  ]),[25,62,18,47,30]);
 }
 const pendentes=lutas.filter(l=>!concluida(l));
 pendentes.forEach((l,n)=>{
  if(n%2===0)pagina('Súmulas dos mesários','Duas súmulas por folha. Preencher inclusive os atletas das fases seguintes definidos no papel.');
  const y=n%2===0?54:167;doc.setDrawColor(90);doc.roundedRect(14,y,182,108,2,2);
  doc.setFont('helvetica','bold');doc.setFontSize(9);doc.setTextColor(20);doc.text(`${codigo(l)} / ${t(l.tatame,'Tatame: ______')} / ${hora(l.horario_estimado)}`,18,y+7);
  doc.setFont('helvetica','normal');doc.setFontSize(6.8);doc.text(`ID no sistema: ${t(l.id)}`,18,y+12);
  doc.setFontSize(8);doc.text(doc.splitTextToSize(`${grupo(l)} / ${t(l.fase)}`,174).slice(0,2),18,y+18);
  doc.text(doc.splitTextToSize(`AZUL (1) #${l.atleta_1_id??'___'}: ${nome(l,1)}`,174).slice(0,2),18,y+28);
  doc.text(doc.splitTextToSize(`VERMELHO (2) #${l.atleta_2_id??'___'}: ${nome(l,2)}`,174).slice(0,2),18,y+39);
  doc.setFontSize(8);doc.text('                    PONTOS          VANTAGENS          PUNIÇÕES',18,y+53);
  doc.text('AZUL (1)       __________       __________          __________',18,y+61);
  doc.text('VERMELHO (2) __________       __________          __________',18,y+69);
  doc.text('Início: ____:____  Fim: ____:____  Tempo/restante: ____:____',18,y+77);
  doc.text('Vencedor: [ ] Azul (1)  [ ] Vermelho (2)  Nome: ______________________',18,y+84);
  doc.setFontSize(7.5);doc.text('Método: [ ] Pontos [ ] Vantagens [ ] Finalização [ ] Decisão [ ] W.O. [ ] Desclassificação',18,y+91);
  doc.text('Árbitro: __________________  Mesário: __________________  Obs.: __________',18,y+98);
  doc.setFontSize(6.8);doc.text('Lançado em: ____/____ ____:____  Por: __________  Conferido por: __________',18,y+104);
 });
 for(const cat of [...new Set(lutas.map(grupo))]){
  const lista=lutas.filter(l=>grupo(l)===cat);
  pagina('Chave / controle dos avanços',cat);
  tabela(['Código / fase','Azul (1) / Vermelho (2)','Resultado na emissão / no papel','Destino / conferência'],lista.map(l=>{
   const baia=idBaiaDaPrimeiraChaveDeTres(l.id_visual,l.fase);const rep=lista.find(c=>String(c.id_visual)===baia);
   return [`${codigo(l)}\n${t(l.fase)}`,`AZ 1: ${nome(l,1)}\nVM 2: ${nome(l,2)}`,concluida(l)?`JÁ SALVO: ${t(l.vencedor)}\n${metodo(l)}\nAZ ${pontos(l.pontuacao_atleta_1)}\nVM ${pontos(l.pontuacao_atleta_2)}`:'Vencedor: ______________\nMétodo: _______________\nLançado [ ] Conferido [ ]',`Vencedor: ${l.proxima_luta?codigo(destino(l)||{}):'Pódio'}${rep?`\nPerdedor: ${codigo(rep)} (baia)`:' '}`];
  }),[28,59,58,37]);
 }
 pagina('Central / conferência após retorno','Organizador: conferir primeiro pesagens e despachos; depois resultados na ordem da chave.');
 tabela(['Código / referência da súmula','Situação no servidor','Conferido / lançado / responsável'],lutas.map(l=>[`${codigo(l)} / ${t(l.categoria)}\nID: ${t(l.id)}`,concluida(l)?`Já concluída na emissão: ${t(l.vencedor)}`:'[ ] Já salvo [ ] Falta lançar\n[ ] Divergência: não sobrescrever','Hora: ____:____\nDigitador: __________\nConferente: __________']),[76,58,48]);
 pagina('Ocorrências e decisões do organizador','Registrar remanejamento de categoria, ausência, W.O., divergência e interrupção de luta.');
 tabela(['Hora / código ou inscrição','Ocorrência / decisão / justificativa','Autorizado por / conferido'],Array.from({length:11},()=>['_________________','________________________________\n________________________________','_________________']),[40,100,42]);
 pagina('Encerramento / pódios conferidos','Apuração no papel e conferência final com o sistema; não contar a mesma medalha duas vezes.');
 tabela(['Categoria / faixa','Ouro','Prata','Bronze(s)','Conferido'],[...new Set(lutas.map(grupo))].map(c=>[c,'____________','____________','____________\n____________','[ ]']),[54,34,34,40,20]);
 const antesIndice=doc.getNumberOfPages();
 const faixas=new Map<string,{inicio:number;fim:number}>();
 secoes.forEach((s,n)=>{const nome=s.titulo.startsWith('Chamada /')?'Chamada por tatame':s.titulo;const fim=(secoes[n+1]?.inicio??antesIndice+1)-1;const atual=faixas.get(nome);faixas.set(nome,{inicio:atual?.inicio??s.inicio,fim});});
 doc.insertPage(2);doc.setPage(2);titulo('Distribuição das folhas por posto','Imprimir frente única nas folhas de escrita. Separar cada bloco e guardar esta edição com a central.');
 tabela(['Bloco','Páginas desta edição','Entregar a'],[...faixas].map(([nome,f])=>[nome,`${f.inicio+1} a ${f.fim+1}`,nome.startsWith('Recepção')?'Recepção':nome.startsWith('Chamada')?'Chamador':nome.startsWith('Súmulas')?'Mesários':'Organizador / central']),[88,36,58],59);
 const total=doc.getNumberOfPages();for(let n=1;n<=total;n++){
  doc.setPage(n);doc.setTextColor(20);doc.setFont('helvetica','bold');doc.setFontSize(10);doc.text('iTATAME / KIT OFFLINE',14,12);
  doc.setFont('helvetica','normal');doc.setFontSize(7.5);doc.text(doc.splitTextToSize(o.eventoNome,182).slice(0,2),14,18);
  doc.setFontSize(6.5);doc.text(`Evento ${t(o.eventoId)} / emissão ${edicao} (${fuso})`,14,29);doc.setDrawColor(170);doc.line(14,32,196,32);
  doc.line(14,282,196,282);doc.text('Guarda do organizador. Edição impressa: conferir alterações posteriores no sistema.',14,287);doc.text(`${n} / ${total}`,196,287,{align:'right'});
 }
 return doc;
}
