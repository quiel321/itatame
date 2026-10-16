import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fusoHorarioEvento } from './evento-datas';
import { criarChavesImpressao, desenharLogo } from './chaves-impressao';

export type LutaKitContingencia = {
  id?: string | number | null; categoria?: string | null; categoria_id?: string | null; faixa?: string | null; fase?: string | null;
  id_visual?: string | number | null; proxima_luta?: string | number | null; tatame?: string | null; ordem?: number | null; ordem_tatame?: number | null;
  horario_estimado?: string | null; atleta_1?: string | null; atleta_2?: string | null; atleta_1_id?: number | null; atleta_2_id?: number | null;
  equipe_1?: string | null; equipe_2?: string | null; vencedor?: string | null; status_luta?: string | null; metodo_vitoria?: string | null;
  pontuacao_atleta_1?: any; pontuacao_atleta_2?: any;
};
export type InscricaoKit = { id: number; atleta: string; atleta_id?: number | null; categoria_id?: string | null; categoria?: string | null; faixa?: string | null; equipe?: string | null; pagamento_ok?: boolean | null; status_checkin?: string | null; peso_aferido?: number | null; pesagem_ok?: boolean | null; kimono_aprovado?: boolean | null };
type CategoriaKit = { id: string; nome?: string; peso_min?: number | null; peso_max?: number | null; tipo?: string | null };
export type OpcoesKit = { eventoNome: string; eventoId?: string; estado?: string | null; tipoChave: string; lutas: LutaKitContingencia[]; inscricoes?: InscricaoKit[]; categorias?: CategoriaKit[]; geradoEm?: Date };
const t = (v: unknown, fallback = '-') => String(v ?? '').trim() || fallback;
const real = (v: unknown) => !['', 'BYE', 'TBD', 'SEM OPONENTE'].includes(t(v, '').toUpperCase());

/** Somente chamada/pesagem e as árvores, com resultados na própria folha. */
export function criarKitContingenciaPDF(o: OpcoesKit) {
  if (o.lutas.some(l => !l.id) || new Set(o.lutas.map(l => String(l.id))).size !== o.lutas.length) {
    throw new Error('Confira a identificação das lutas antes de imprimir.');
  }
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  const fuso = fusoHorarioEvento(o.estado);
  const emissao = (o.geradoEm || new Date()).toLocaleString('pt-BR', { timeZone: fuso, hour12: false });
  // Usa todas as inscrições, inclusive quem ainda não entrou em uma chave.
  const inscritos = o.inscricoes ?? o.lutas.flatMap(l => ([1, 2] as const).filter(lado => real(lado === 1 ? l.atleta_1 : l.atleta_2)).map(lado => ({
    id: (lado === 1 ? l.atleta_1_id : l.atleta_2_id) || 0,
    atleta: t(lado === 1 ? l.atleta_1 : l.atleta_2),
    categoria: l.categoria, categoria_id: l.categoria_id, faixa: l.faixa,
    equipe: lado === 1 ? l.equipe_1 : l.equipe_2,
  } as InscricaoKit)));
  const unicos = [...new Map(inscritos.map(i => [JSON.stringify([i.categoria_id || i.categoria, i.id || i.atleta_id || i.atleta]), i])).values()];
  const grupos = new Map<string, InscricaoKit[]>();
  for (const i of unicos) {
    const chave = JSON.stringify([i.categoria_id || i.categoria]);
    grupos.set(chave, [...(grupos.get(chave) || []), i]);
  }
  const listas = [...grupos.values()].sort((a, b) => t(a[0].categoria).localeCompare(t(b[0].categoria), 'pt-BR'));
  if (!listas.length) listas.push([]);
  let primeira = true;
  for (const lista of listas) {
    if (!primeira) doc.addPage();
    primeira = false;
    const base = lista[0];
    const categoria = o.categorias?.find(c => c.id === base?.categoria_id);
    const limite = categoria?.tipo === 'absoluto' ? 'Absoluto: sem limite de peso' : categoria ? `Peso: acima de ${categoria.peso_min ?? 0} kg${categoria.peso_max != null ? ` até ${categoria.peso_max} kg` : ''}` : '';
    const cabecalho = () => {
      doc.setFillColor(220, 38, 38); doc.rect(0, 0, 297, 3.2, 'F');
      doc.setFillColor(250, 250, 252); doc.rect(0, 3.2, 297, 22.5, 'F');
      desenharLogo(doc, 10, 7.2);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(24, 24, 27);
      doc.text(doc.splitTextToSize(o.eventoNome.toUpperCase(), 175).slice(0, 2), 62, 12.2);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
      doc.text('www.itatame.com.br', 287, 12.2, { align: 'right' });
      doc.setFillColor(24, 24, 27); doc.rect(0, 25.7, 297, 16.2, 'F');
      doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
      doc.text('RECEPÇÃO / LISTA DE CHAMADA E PESAGEM', 10, 31.5);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
      doc.text(doc.splitTextToSize(`${t(base?.categoria, 'Sem inscrições')} · ${limite} · ${lista.length} atleta(s)`, 277).slice(0, 1), 10, 38.2);
      doc.setTextColor(82, 82, 91); doc.setFontSize(7);
      doc.text('Anote presença, peso e liberação. Pendências e mudança de categoria: consultar o organizador.', 10, 47);
      doc.setDrawColor(228, 228, 231); doc.line(10, 196, 287, 196);
      doc.setFontSize(6.2); doc.text(`Emissão: ${emissao}. Situação impressa não acompanha alterações posteriores.`, 10, 201);
      doc.text(`itatame.com.br · Página ${doc.getNumberOfPages()}`, 287, 201, { align: 'right' });
    };
    autoTable(doc, {
      startY: 52, margin: { top: 52, bottom: 17, left: 10, right: 10 }, theme: 'grid',
      head: [['Inscrição / atleta / equipe', 'Situação na emissão', 'Presença / conferência', 'Peso / liberação no papel', 'Chamadas / envio ao tatame']],
      body: lista.length ? [...lista].sort((a, b) => a.atleta.localeCompare(b.atleta, 'pt-BR')).map(i => [
        `#${i.id || '-'} · ${i.atleta}\n${t(i.equipe)} · Faixa ${t(i.faixa)}`,
        `${i.pagamento_ok === true ? 'Pago' : i.pagamento_ok === false ? 'Pagamento pendente' : 'Pagamento: conferir'} · ${t(i.status_checkin, 'pendente')}${i.peso_aferido != null ? `\nPeso: ${i.peso_aferido} kg` : ''}`,
        '[ ] Presente  [ ] Ausente\n[ ] Documento  [ ] Kimono/faixa',
        'Peso: ______ kg  [ ] Apto  [ ] Reprovado\nMotivo / rubrica: __________________',
        '1ª __:__  2ª __:__  3ª __:__\nTatame: ______  Envio: __:__',
      ]) : [['Sem inscrições disponíveis. Confira antes de usar.', '-', '-', '-', '-']],
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.4, minCellHeight: 14, valign: 'middle', overflow: 'linebreak' },
      headStyles: { fillColor: [24, 24, 27], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [250, 250, 252] }, rowPageBreak: 'avoid', showHead: 'everyPage',
      columnStyles: { 0: { cellWidth: 77 }, 1: { cellWidth: 43 }, 2: { cellWidth: 47 }, 3: { cellWidth: 61 }, 4: { cellWidth: 49 } },
      didDrawPage: cabecalho,
    });
  }
  if (o.lutas.length) criarChavesImpressao({ eventoNome: o.eventoNome, lutas: o.lutas, documento: doc, contingencia: { fuso, emissao } });
  return doc;
}
