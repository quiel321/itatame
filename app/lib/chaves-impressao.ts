import { jsPDF } from 'jspdf';
import { obterTempoRegulamentar } from './cronograma';
import type { LutaKitContingencia } from './kit-contingencia-pdf';
import { rotuloLuta } from './lutas-rotulos';

export type LutaImpressao = LutaKitContingencia & { numero_1?: string; numero_2?: string; atleta_1_id?: number | null; atleta_2_id?: number | null; tempo_minutos?: number | null };
type No = { luta?: LutaImpressao; nome?: string; equipe?: string; numero?: string; filhos?: No[]; pagina?: number };

const limpo = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim();
const real = (v: unknown) => v && !['BYE', 'TBD'].includes(limpo(v).toUpperCase());
export const chaveGrupoPDF = (l: LutaImpressao) => JSON.stringify([l.categoria || '', l.faixa || '']);

export function tituloEventoImpressao(nome: string, cidade?: string | null) {
  const evento = limpo(nome) || 'Campeonato';
  const local = limpo(cidade);
  if (!local) return evento;
  if (evento.toUpperCase().includes(local.toUpperCase())) return evento;
  return `${evento} - ${local.toUpperCase()}`;
}

function codigoNumerico(texto: string) {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return String(100000 + ((h >>> 0) % 900000));
}

export function desenharLogo(doc: jsPDF, x: number, y: number) {
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
export function criarChavesImpressao({ eventoNome, eventoCidade, lutas, documento, contingencia }: { eventoNome: string; eventoCidade?: string | null; lutas: LutaImpressao[]; documento?: jsPDF; contingencia?: { fuso: string; emissao: string } }) {
  if (!lutas.length) throw new Error('Nenhuma chave para imprimir.');
  const tituloEvento = tituloEventoImpressao(eventoNome, eventoCidade);
  const doc = documento || new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const grupos = new Map<string, LutaImpressao[]>();
  for (const l of lutas) {
    const k = contingencia ? JSON.stringify([l.categoria_id || l.categoria || '', l.categoria || '']) : chaveGrupoPDF(l);
    grupos.set(k, [...(grupos.get(k) || []), l]);
  }
  let folhas = documento ? documento.getNumberOfPages() : 0;

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
    doc.setDrawColor(160, 160, 160);
    doc.setLineWidth(0.22);
    doc.line(x, y, x + w, y);
  }

  function pagina(base: LutaImpressao, titulo: string, atletas: number) {
    if (folhas++) doc.addPage();
    const codigo = codigoNumerico(contingencia ? `${tituloEvento}|${base.categoria_id || ''}|${base.categoria}` : `${tituloEvento}|${base.categoria}|${base.faixa}`);
    const area = limpo(base.tatame) || '_______';
    const horario = base.horario_estimado
      ? new Date(base.horario_estimado).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', ...(contingencia ? { timeZone: contingencia.fuso } : {}) })
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
    texto(tituloEvento.toUpperCase(), 62, 12.2, 168, 11, 2);
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
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    texto(contingencia ? (limpo(base.categoria) || 'Categoria') : `${limpo(base.categoria) || 'Categoria'}  ·  Faixa ${limpo(base.faixa) || '—'}`, 10, 31.4, 277, 9, 2);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.4);
    doc.setTextColor(212, 212, 216);
    doc.text(`${titulo}   ·   Chave Nº ${codigo}   ·   ${atletas} atleta(s)   ·   Tempo: ${tempo} min   ·   Área: ${area}   ·   Horário: ${horario}`, 10, 38.2);

    if (!contingencia) {
    doc.setFillColor(247, 247, 248);
    doc.roundedRect(10, 169, 277, 23.5, 2, 2, 'F');
    doc.setDrawColor(220, 38, 38);
    doc.setLineWidth(0.7);
    doc.line(224, 172, 224, 190);
    doc.setTextColor(220, 38, 38);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('RESULTADO FINAL', 13, 173.4);
    doc.setDrawColor(228, 228, 231);
    doc.setLineWidth(0.25);

    const blocos = ['1º', '2º', '3º', '3º'];
    blocos.forEach((pos, i) => {
      const x = 13 + i * 52;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(24, 24, 27);
      doc.text(pos, x, 179.2);
      linhaCampo(x + 6, 179.6, 42);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.4);
      doc.setTextColor(113, 113, 122);
      doc.text('Equipe', x, 187);
      linhaCampo(x + 9, 187.4, 39);
    });

    doc.setDrawColor(228, 228, 231);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.9);
    doc.setTextColor(63, 63, 70);
    doc.text('CONTROLE DA ÁREA', 228, 173.4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(63, 63, 70);
    doc.text('Área: ____  Coordenador: __________', 228, 178);
    doc.text('Entrega: ____:____  Devolução: ____:____', 228, 182.2);
    doc.text('Pesagem: ___  Premiação: ___', 228, 186.4);
    doc.text('Resultado registrado: ___', 228, 190.2);
    }

    doc.setDrawColor(228, 228, 231);
    doc.line(10, 196, 287, 196);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.2);
    doc.setTextColor(113, 113, 122);
    doc.text(contingencia ? `Emissão: ${contingencia.emissao}. Confira resultados já salvos antes de lançar o papel no sistema.` : 'Avanço sem adversário não é combate. Vagas futuras dependem dos resultados anteriores. Número = posição na chave.', 10, 201);
    doc.text(`itatame.com.br  ·  Página ${doc.getNumberOfPages()}`, 287, 201, { align: 'right' });
    doc.setTextColor(24, 24, 27);
    doc.setDrawColor(100, 100, 100);
    doc.setLineWidth(0.25);
    return doc.getNumberOfPages();
  }

  // Os registros ficam na própria folha da árvore, sem súmulas adicionais.
  function resultados(lista: LutaImpressao[]) {
    if (!contingencia) return;
    doc.setFillColor(247, 247, 248); doc.rect(10, 149, 277, 45, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(24, 24, 27);
    doc.text('RESULTADOS NO PAPEL', 13, 153);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6);
    doc.text('AZ = acima/esquerda; VM = abaixo/direita. Placar: pontos/vantagens/punições. [ ] = lançado no sistema.', 76, 153);
    lista.forEach((l, i) => {
      const duasColunas = lista.length > 7;
      const x = 13 + (i >= 8 ? 139 : 0), y = 158 + (i % 8) * (duasColunas ? 4.8 : 5.2);
      const largura = duasColunas ? 132 : 271;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(24, 24, 27);
      if (l.vencedor || l.status_luta === 'concluida') {
        const p = (v: any) => `${v?.pontos ?? 0}/${v?.vantagens ?? 0}/${v?.punicoes ?? 0}`;
        texto(`L${l.id_visual} JÁ SALVO: ${l.vencedor || '-'} · ${l.pontuacao_atleta_1?.metodo_sumula || l.metodo_vitoria || '-'} · AZ ${p(l.pontuacao_atleta_1)} VM ${p(l.pontuacao_atleta_2)}`, x, y, largura, 7, 1);
      } else {
        const nome = duasColunas ? '________________________' : '________________________________________________';
        const metodo = duasColunas ? '______________' : '________________________';
        doc.text(`L${l.id_visual}  Venc.: ${nome}  AZ ___/___/___  VM ___/___/___  Mét.: ${metodo} [ ]`, x, y);
      }
      doc.setDrawColor(210); doc.setLineWidth(0.15); doc.line(x, y + 1.3, x + largura, y + 1.3);
    });
  }

  for (const grupo of grupos.values()) {
    const base = grupo[0];
    const atletas = new Set(grupo.flatMap(l => [l.atleta_1_id || (real(l.atleta_1) ? l.atleta_1 : null), l.atleta_2_id || (real(l.atleta_2) ? l.atleta_2 : null)]).filter(Boolean));

    if (grupo.some(l => String(l.fase).includes('Chave de 3'))) {
      pagina(base, 'Chave de 3 atletas', atletas.size);
      const ordenadas = [...grupo].sort((a, b) => Number(a.id_visual) - Number(b.id_visual));
      ordenadas.forEach((l, i) => {
        const x = 10 + i * 93;
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(212, 212, 216);
        doc.roundedRect(x, 48, 87, 88, 2, 2, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(220, 38, 38);
        texto(`${contingencia ? `L${l.id_visual} · ` : ''}${rotuloLuta(l)}`, x + 4, 56, 79, 9);
        doc.setTextColor(24, 24, 27);
        doc.setFont('helvetica', 'normal');
        const a1 = real(l.atleta_1) ? `${l.numero_1 ? `${l.numero_1}  ` : ''}${l.atleta_1}` : (i === 1 ? 'Perdedor da luta 1' : 'Vencedor da luta 1');
        const a2 = real(l.atleta_2) ? `${l.numero_2 ? `${l.numero_2}  ` : ''}${l.atleta_2}` : (i === 2 ? 'Vencedor da luta 2' : 'A definir');
        texto(a1, x + 4, 70, 79, 8);
        texto(real(l.atleta_1) ? (l.equipe_1 || '') : '', x + 4, 76, 79, 6.5);
        texto(a2, x + 4, 92, 79, 8);
        texto(real(l.atleta_2) ? (l.equipe_2 || '') : '', x + 4, 98, 79, 6.5);
        linhaCampo(x + 4, 118, 79);
        texto(`Vencedor: ${l.vencedor || ''}`, x + 4, 116, 79, 7.5);
      });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.4);
      doc.setTextColor(82, 82, 91);
      texto('Luta 1: o vencedor vai à final; o perdedor enfrenta o terceiro atleta na luta 2. O vencedor da luta 2 completa a final.', 10, contingencia ? 143 : 146, 277, 7.4, 2);
      resultados(ordenadas);
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
      const colunas = Math.max(0, niveis - 1);
      const centroW = colunas ? 42 : 80;
      const centroX = (297 - centroW) / 2;
      const disponivel = centroX - 10;
      const gap = colunas === 1 ? disponivel - Math.min(70, disponivel - 4) : 4;
      const util = disponivel - colunas * gap;
      const primeiraW = colunas === 1 ? util : Math.min(colunas >= 3 ? 48 : 55, util - (colunas - 1) * 28);
      const larguras = Array.from({ length: colunas }, (_, i) => i ? (util - primeiraW) / (colunas - 1) : primeiraW);
      const posicoes = larguras.map((_, i) => 10 + larguras.slice(0, i).reduce((soma, w) => soma + w + gap, 0));
      const top = 60, bottom = contingencia ? 143 : 163, meio = (top + bottom) / 2;
      const rotulos = new Map<number, string>();
      function coletarRotulos(no: No) {
        if (!no.filhos) return;
        rotulos.set(profundidade(no) - 1, limpo(no.luta?.fase).replace(/\s+\d+.*$/, '') || 'Próxima fase');
        no.filhos.forEach(coletarRotulos);
      }
      coletarRotulos(n);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(6.8); doc.setTextColor(90, 90, 100);
      larguras.forEach((w, i) => {
        doc.text((rotulos.get(i) || '').toUpperCase(), posicoes[i] + w / 2, 55.5, { align: 'center' });
        doc.text((rotulos.get(i) || '').toUpperCase(), 297 - posicoes[i] - w / 2, 55.5, { align: 'center' });
      });
      function dadosSlot(no: No): No {
        if (!no.luta) return no;
        return { nome: limpo(no.luta.vencedor) || '________________', equipe: `Vencedor: ${contingencia ? `L${no.luta.id_visual} · ` : ''}${rotuloLuta(no.luta)}` };
      }
      function cartao(no: No, x: number, y: number, w: number, h: number) {
        const dados = dadosSlot(no), nome = limpo(dados.nome), vazio = !real(nome);
        const nomeVisivel = nome.toUpperCase() === 'BYE' ? 'Sem adversário' : vazio ? 'A definir' : nome;
        doc.setFillColor(vazio ? 248 : 255, vazio ? 248 : 255, vazio ? 250 : 255);
        doc.setDrawColor(190, 190, 198); doc.setLineWidth(0.24);
        doc.roundedRect(x, y - h / 2, w, h, 1.1, 1.1, 'FD');
        const numerado = Boolean(dados.numero && !vazio);
        if (numerado) {
          doc.setFillColor(24, 24, 27);
          doc.roundedRect(x + 1, y - 2.2, 4.8, 4.4, 0.6, 0.6, 'F');
          doc.setFont('helvetica', 'bold'); doc.setFontSize(5.4); doc.setTextColor(255, 255, 255);
          doc.text(dados.numero!, x + 3.4, y + 0.7, { align: 'center' });
        }
        const tx = x + (numerado ? 7 : 2), tw = w - (numerado ? 8.5 : 4);
        doc.setFont('helvetica', 'bold'); doc.setTextColor(vazio ? 130 : 24, vazio ? 130 : 24, vazio ? 136 : 27);
        texto(nomeVisivel, tx, y - h / 2 + 3.1, tw, w > 70 ? 8 : w < 35 ? 6.1 : 7, 2);
        doc.setFont('helvetica', 'normal'); doc.setTextColor(110, 110, 120);
        texto(dados.pagina ? `Continua da página ${dados.pagina}` : (dados.equipe || ''), tx, y + h / 2 - 1.2, tw, 5.2, 1);
      }
      function ramo(no: No, direita: boolean, total: number, contador: { valor: number }): { x: number; y: number } {
        const nivel = profundidade(no), w = larguras[nivel];
        const x = direita ? 297 - posicoes[nivel] - w : posicoes[nivel];
        let y: number;
        if (!no.filhos) y = top + (++contador.valor - 0.5) * (bottom - top) / total;
        else {
          const filhos = no.filhos.map(filho => ramo(filho, direita, total, contador));
          y = (filhos[0].y + filhos[1].y) / 2;
          const juncao = direita ? x + w + gap / 2 : x - gap / 2;
          doc.setDrawColor(120, 120, 130); doc.setLineWidth(0.3);
          filhos.forEach(f => doc.line(f.x, f.y, juncao, f.y));
          doc.line(juncao, filhos[0].y, juncao, filhos[1].y);
          doc.line(juncao, y, direita ? x + w : x, y);
        }
        cartao(no, x, y, w, Math.min(12, (bottom - top) / total - 1.5));
        return { x: direita ? x : x + w, y };
      }
      n.filhos?.forEach((lado, indice) => {
        if (!lado.filhos) return;
        const direita = indice === 1, total = folhasNo(lado), contador = { valor: 0 };
        const pontos = lado.filhos.map(filho => ramo(filho, direita, total, contador));
        const x = direita ? centroX + centroW + gap / 2 : centroX - gap / 2;
        doc.setDrawColor(120, 120, 130); doc.setLineWidth(0.3);
        pontos.forEach(f => doc.line(f.x, f.y, x, f.y));
        doc.line(x, pontos[0].y, x, pontos[1].y);
        doc.line(x, meio, direita ? centroX + centroW : centroX, meio);
      });
      doc.setFont('helvetica', 'bold'); doc.setTextColor(220, 38, 38);
      texto(`${contingencia ? `L${n.luta?.id_visual} · ` : ''}${(rotulos.get(niveis - 1) || 'Final').toUpperCase()}`, 148.5, meio - 20, centroW, 7.4, 1, 'center');
      doc.setFillColor(252, 252, 253); doc.setDrawColor(220, 38, 38); doc.setLineWidth(0.4);
      doc.roundedRect(centroX, meio - 16, centroW, 32, 2, 2, 'FD');
      n.filhos?.forEach((lado, i) => cartao(lado, centroX + 2, meio + (i ? 7 : -7), centroW - 4, 12));
      doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(130, 100, 20);
      doc.text(n.luta?.proxima_luta ? 'CLASSIFICADO' : 'CAMPEÃO', 148.5, 48, { align: 'center' });
      doc.setTextColor(24, 24, 27);
      texto(limpo(n.luta?.vencedor) || '________________________', 148.5, 52, Math.max(42, centroW), 7.3, 1, 'center');
      const impressas: LutaImpressao[] = [];
      function coletar(no: No) { if (no.luta) impressas.push(no.luta); no.filhos?.forEach(coletar); }
      coletar(n);
      resultados(impressas.sort((a, b) => Number(a.id_visual) - Number(b.id_visual)));
      return p;
    }
    imprimir(raiz);
  }
  return doc;
}
