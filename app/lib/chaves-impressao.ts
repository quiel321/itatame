import { jsPDF } from 'jspdf';
import { obterTempoRegulamentar } from './cronograma';
import type { LutaKitContingencia } from './kit-contingencia-pdf';
import { rotuloLuta } from './lutas-rotulos';

export type LutaImpressao = LutaKitContingencia & { numero_1?: string; numero_2?: string; atleta_1_id?: number | null; atleta_2_id?: number | null; tempo_minutos?: number | null };
type No = { luta?: LutaImpressao; nome?: string; equipe?: string; numero?: string; filhos?: No[]; pagina?: number };

const limpo = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim();
const real = (v: unknown) => v && !['BYE', 'TBD'].includes(limpo(v).toUpperCase());
export const chaveGrupoPDF = (l: LutaImpressao) => JSON.stringify([l.categoria || '', l.faixa || '']);

function codigoNumerico(texto: string) {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return String(100000 + ((h >>> 0) % 900000));
}

function desenharLogo(doc: jsPDF, x: number, y: number) {
  doc.setFillColor(220, 38, 38);
  doc.roundedRect(x, y, 4.2, 9.2, 2.1, 2.1, 'F');
  doc.setFillColor(24, 24, 27);
  doc.roundedRect(x + 5.6, y, 4.2, 9.2, 2.1, 2.1, 'F');
  doc.setFont('helvetica', 'bolditalic');
  doc.setFontSize(16);
  doc.setTextColor(220, 38, 38);
  doc.text('i', x + 12.2, y + 7.3);
  doc.setTextColor(24, 24, 27);
  doc.text('TATAME', x + 15.4, y + 7.3);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(4.4);
  doc.setTextColor(113, 113, 122);
  doc.text('SISTEMA DE CAMPEONATOS', x + 12.2, y + 10.8);
}

/** Imprime a árvore real, inclusive BYEs. Grandes chaves são repartidas com referências entre páginas. */
export function criarChavesImpressao({ eventoNome, lutas }: { eventoNome: string; lutas: LutaImpressao[] }) {
  if (!lutas.length) throw new Error('Nenhuma chave para imprimir.');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const grupos = new Map<string, LutaImpressao[]>();
  for (const l of lutas) {
    const k = chaveGrupoPDF(l);
    grupos.set(k, [...(grupos.get(k) || []), l]);
  }
  let folhas = 0;

  function texto(s: string, x: number, y: number, w: number, size = 8, maxLines = 2, align: 'left' | 'center' | 'right' = 'left') {
    doc.setFontSize(size);
    const linhas = doc.splitTextToSize(s, w) as string[];
    if (linhas.length > maxLines) {
      linhas.length = maxLines;
      linhas[maxLines - 1] = `${linhas[maxLines - 1].slice(0, Math.max(0, linhas[maxLines - 1].length - 3))}...`;
    }
    doc.text(linhas, x, y, { align });
  }

  function linhaCampo(x: number, y: number, w: number) {
    doc.setDrawColor(160);
    doc.setLineWidth(0.22);
    doc.line(x, y, x + w, y);
  }

  function pagina(base: LutaImpressao, titulo: string, atletas: number) {
    if (folhas++) doc.addPage();
    const codigo = codigoNumerico(`${eventoNome}|${base.categoria}|${base.faixa}`);
    const area = limpo(base.tatame) || '_______';
    const horario = base.horario_estimado
      ? new Date(base.horario_estimado).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      : '____:____';
    const tempo = base.tempo_minutos || obterTempoRegulamentar(base.categoria || '', base.faixa || '');

    doc.setFillColor(220, 38, 38);
    doc.rect(0, 0, 297, 3.2, 'F');
    doc.setFillColor(250, 250, 252);
    doc.rect(0, 3.2, 297, 22.5, 'F');
    desenharLogo(doc, 10, 7.2);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(24, 24, 27);
    texto(eventoNome.toUpperCase(), 62, 12.2, 168, 11, 2);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(82, 82, 91);
    doc.text('www.itatame.com.br', 287, 12.2, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(220, 38, 38);
    doc.text(`Código da chave: ${codigo}`, 287, 18.6, { align: 'right' });

    doc.setFillColor(24, 24, 27);
    doc.rect(0, 25.7, 297, 16.2, 'F');
    doc.setTextColor(255);
    doc.setFont('helvetica', 'bold');
    texto(`${limpo(base.categoria) || 'Categoria'}  ·  Faixa ${limpo(base.faixa) || '—'}`, 10, 31.4, 200, 9, 1);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.4);
    doc.setTextColor(212, 212, 216);
    doc.text(`${titulo}   ·   Chave Nº ${codigo}   ·   ${atletas} atleta(s)   ·   Tempo: ${tempo} min   ·   Área: ${area}   ·   Horário: ${horario}`, 10, 38.2);

    doc.setFillColor(247, 247, 248);
    doc.roundedRect(221, 45, 66, 146, 2, 2, 'F');
    doc.setDrawColor(220, 38, 38);
    doc.setLineWidth(0.7);
    doc.line(221, 45, 221, 191);
    doc.setTextColor(220, 38, 38);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('RESULTADO FINAL', 254, 52, { align: 'center' });
    doc.setDrawColor(228, 228, 231);
    doc.setLineWidth(0.25);
    doc.line(227, 55, 281, 55);

    const blocos = ['1º', '2º', '3º', '3º'];
    blocos.forEach((pos, i) => {
      const y = 63 + i * 16.2;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(24, 24, 27);
      doc.text(pos, 227, y);
      linhaCampo(236, y + 0.4, 45);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.4);
      doc.setTextColor(113, 113, 122);
      doc.text('Equipe', 227, y + 6.4);
      linhaCampo(238, y + 6.6, 43);
    });

    doc.setDrawColor(228, 228, 231);
    doc.line(227, 128, 281, 128);
    const campos = [
      ['Coordenador', 136],
      ['Nº da área', 146],
      ['Horário da entrega', 156],
      ['Horário da devolução', 166],
    ] as const;
    campos.forEach(([label, y]) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.4);
      doc.setTextColor(82, 82, 91);
      doc.text(label, 227, y);
      linhaCampo(227, y + 3.4, 54);
    });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(63, 63, 70);
    doc.text('Pesagem realizada?  ______', 227, 176);
    doc.text('Premiação realizada?  ______', 227, 182);
    doc.text('Resultado registrado?  ______', 227, 188);

    doc.setDrawColor(228, 228, 231);
    doc.line(10, 196, 287, 196);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.2);
    doc.setTextColor(113, 113, 122);
    doc.text('LEGENDA: BYE = sem adversário  ·  TBD = aguarda o resultado da luta anterior  ·  Número à esquerda = posição na chave', 10, 201);
    doc.text(`itatame.com.br  ·  Página ${doc.getNumberOfPages()}`, 287, 201, { align: 'right' });
    doc.setTextColor(24, 24, 27);
    doc.setDrawColor(100);
    doc.setLineWidth(0.25);
    return doc.getNumberOfPages();
  }

  for (const grupo of grupos.values()) {
    const base = grupo[0];
    const atletas = new Set(grupo.flatMap(l => [l.atleta_1_id || (real(l.atleta_1) ? l.atleta_1 : null), l.atleta_2_id || (real(l.atleta_2) ? l.atleta_2 : null)]).filter(Boolean));

    if (grupo.some(l => String(l.fase).includes('Chave de 3'))) {
      pagina(base, 'Chave de 3 atletas', atletas.size);
      const ordenadas = [...grupo].sort((a, b) => Number(a.id_visual) - Number(b.id_visual));
      ordenadas.forEach((l, i) => {
        const x = 10 + i * 69;
        doc.setFillColor(255);
        doc.setDrawColor(212, 212, 216);
        doc.roundedRect(x, 48, 65, 88, 2, 2, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(220, 38, 38);
        texto(rotuloLuta(l), x + 4, 56, 57, 9);
        doc.setTextColor(24, 24, 27);
        doc.setFont('helvetica', 'normal');
        const a1 = real(l.atleta_1) ? `${l.numero_1 ? `${l.numero_1}  ` : ''}${l.atleta_1}` : (i === 1 ? 'Perdedor da luta 1' : 'Vencedor da luta 1');
        const a2 = real(l.atleta_2) ? `${l.numero_2 ? `${l.numero_2}  ` : ''}${l.atleta_2}` : (i === 2 ? 'Vencedor da luta 2' : 'A definir');
        texto(a1, x + 4, 70, 57, 8);
        texto(real(l.atleta_1) ? (l.equipe_1 || '') : '', x + 4, 76, 57, 6.5);
        texto(a2, x + 4, 92, 57, 8);
        texto(real(l.atleta_2) ? (l.equipe_2 || '') : '', x + 4, 98, 57, 6.5);
        linhaCampo(x + 4, 118, 57);
        texto(`Vencedor: ${l.vencedor || ''}`, x + 4, 116, 57, 7.5);
      });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.4);
      doc.setTextColor(82, 82, 91);
      texto('Luta 1: o vencedor vai à final; o perdedor enfrenta o terceiro atleta na luta 2. O vencedor da luta 2 completa a final.', 10, 146, 205, 7.4, 2);
      continue;
    }

    const porId = new Map(grupo.map(l => [String(l.id_visual), l]));
    const finais = grupo.filter(l => !l.proxima_luta);
    if (finais.length !== 1) throw new Error(`Categoria ${base.categoria}: final ausente ou duplicada. Confira a chave.`);

    function montar(l: LutaImpressao, caminho: Set<string>): No {
      const id = String(l.id_visual);
      if (caminho.has(id)) throw new Error('Chave com dependência circular.');
      const proximo = new Set([...caminho, id]);
      const alimentadoras = grupo.filter(a => String(a.proxima_luta) === id);
      const filhos = [1, 2].map(lado => {
        const origem = alimentadoras.find(a => Number(a.id_visual) % 2 === (lado === 1 ? 1 : 0));
        if (origem) return montar(origem, proximo);
        return {
          nome: limpo(lado === 1 ? l.atleta_1 : l.atleta_2) || 'TBD',
          equipe: limpo(lado === 1 ? l.equipe_1 : l.equipe_2),
          numero: limpo(lado === 1 ? l.numero_1 : l.numero_2),
        };
      });
      return { luta: l, filhos };
    }

    if (porId.size !== grupo.length) throw new Error('IDs de luta repetidos na categoria.');
    const raiz = montar(finais[0], new Set());
    const folhasNo = (n: No): number => n.filhos ? n.filhos.reduce((s, f) => s + folhasNo(f), 0) : 1;
    const profundidade = (n: No): number => n.filhos ? 1 + Math.max(...n.filhos.map(profundidade)) : 0;

    function imprimir(n: No): number {
      if (folhasNo(n) > 16) {
        n = { ...n, filhos: n.filhos!.map(f => ({ nome: `Vencedor da ${rotuloLuta(f.luta || {})}`, pagina: imprimir(f) })) };
      }
      const p = pagina(base, n.luta?.proxima_luta ? `Seção até ${rotuloLuta(n.luta)}` : 'Chave / fase final', atletas.size);
      const niveis = profundidade(n);
      const total = folhasNo(n);
      let indice = 0;
      const largura = 206 / (niveis + 1);

      function desenhar(no: No): { x: number; y: number } {
        const nivel = profundidade(no);
        const x = 10 + nivel * largura;
        if (!no.filhos) {
          const y = 52 + (indice++ + 0.5) * 138 / total;
          const compacto = total > 8;
          const numero = no.numero || String(indice).padStart(2, '0');
          doc.setFillColor(24, 24, 27);
          doc.roundedRect(x, y - 4.6, 7.2, 6.2, 0.6, 0.6, 'F');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(6);
          doc.setTextColor(255);
          doc.text(numero, x + 3.6, y - 0.5, { align: 'center' });
          doc.setTextColor(24, 24, 27);
          doc.setFont('helvetica', 'bold');
          texto(no.nome || 'TBD', x + 8.6, y - 1.6, largura - 12, compacto ? 6.6 : 8, 1);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(82, 82, 91);
          texto(no.pagina ? `Origem: página ${no.pagina}` : (no.equipe || ''), x + 8.6, y + 1.8, largura - 12, 6, 1);
          doc.setDrawColor(120);
          doc.line(x, y + 3.4, x + largura - 4, y + 3.4);
          return { x: x + largura - 4, y: y + 3.4 };
        }
        const filhos = no.filhos.map(desenhar);
        const y = (filhos[0].y + filhos[1].y) / 2;
        doc.setDrawColor(90);
        doc.setLineWidth(0.35);
        for (const f of filhos) {
          doc.line(f.x, f.y, x - 1, f.y);
          doc.line(x - 1, f.y, x - 1, y);
        }
        doc.line(x - 1, y, x + largura - 5, y);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(24, 24, 27);
        texto(`${rotuloLuta(no.luta || {})}: ${no.luta?.vencedor || '________________'}`, x + 1, y - 2.2, largura - 6, 7, 2);
        return { x: x + largura - 5, y };
      }
      desenhar(n);
      return p;
    }
    imprimir(raiz);
  }
  return doc;
}
