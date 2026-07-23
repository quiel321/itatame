import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export type LutaKitContingencia = {
  id?: string | number | null;
  categoria?: string | null;
  faixa?: string | null;
  fase?: string | null;
  id_visual?: string | number | null;
  proxima_luta?: string | number | null;
  tatame?: string | null;
  ordem?: number | null;
  ordem_tatame?: number | null;
  horario_estimado?: string | null;
  atleta_1?: string | null;
  atleta_2?: string | null;
  equipe_1?: string | null;
  equipe_2?: string | null;
  vencedor?: string | null;
  status_luta?: string | null;
  metodo_vitoria?: string | null;
  pontuacao_atleta_1?: unknown;
  pontuacao_atleta_2?: unknown;
};

type OpcoesKit = {
  eventoNome: string;
  tipoChave: string;
  lutas: LutaKitContingencia[];
  geradoEm?: Date;
};

const LARGURA = 210;
const ALTURA = 297;
const TOPO = 38;
const RODAPE = 15;
const LIMITE = ALTURA - RODAPE;

function texto(valor: unknown, fallback = "-") {
  const resultado = String(valor ?? "").trim();
  return resultado || fallback;
}

function nomeReal(valor: unknown) {
  const nome = texto(valor, "");
  const normalizado = nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  if (!normalizado || ["BYE", "TBD", "A DEFINIR", "SEM OPONENTE", "SEM ADVERSARIO"].some((item) => normalizado.includes(item))) return "A DEFINIR";
  return nome;
}

function estaConcluida(luta: LutaKitContingencia) {
  return luta.status_luta === "concluida" || Boolean(texto(luta.vencedor, ""));
}

function parsePontuacao(valor: unknown) {
  if (!valor) return {} as Record<string, unknown>;
  if (typeof valor === "object") return valor as Record<string, unknown>;
  try { return JSON.parse(String(valor)) as Record<string, unknown>; } catch { return {} as Record<string, unknown>; }
}

function metodoDaLuta(luta: LutaKitContingencia) {
  const p1 = parsePontuacao(luta.pontuacao_atleta_1);
  const p2 = parsePontuacao(luta.pontuacao_atleta_2);
  if (p1.decisao_arbitro || p2.decisao_arbitro) return "Decisão do árbitro";
  const metodo = texto(luta.metodo_vitoria, "").toLowerCase();
  if (metodo === "finalizacao") return "Finalização";
  if (metodo === "pontos") return "Pontos";
  if (metodo === "wo") return "W.O.";
  if (metodo === "avanco_direto") return "Avanço direto";
  return metodo ? metodo.replace(/_/g, " ") : "-";
}

function placarDaLuta(luta: LutaKitContingencia) {
  const p1 = parsePontuacao(luta.pontuacao_atleta_1);
  const p2 = parsePontuacao(luta.pontuacao_atleta_2);
  if (p1.pontos == null && p2.pontos == null) return "-";
  return `${Number(p1.pontos || 0)} x ${Number(p2.pontos || 0)}`;
}

function formatarHorario(valor?: string | null) {
  if (!valor) return "--:--";
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? "--:--" : data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function grupoDaLuta(luta: LutaKitContingencia) {
  return `${texto(luta.categoria, "Categoria a definir")} · Faixa ${texto(luta.faixa, "-")}`;
}

function ordenarLutas(a: LutaKitContingencia, b: LutaKitContingencia) {
  const tatame = texto(a.tatame, "ZZZ").localeCompare(texto(b.tatame, "ZZZ"), "pt-BR", { numeric: true });
  if (tatame !== 0) return tatame;
  const ordemTatame = Number(a.ordem_tatame ?? 9999) - Number(b.ordem_tatame ?? 9999);
  if (ordemTatame !== 0) return ordemTatame;
  const categoria = grupoDaLuta(a).localeCompare(grupoDaLuta(b), "pt-BR");
  if (categoria !== 0) return categoria;
  return Number(a.id_visual ?? 9999) - Number(b.id_visual ?? 9999);
}

function desenharTituloSecao(doc: jsPDF, titulo: string, subtitulo?: string) {
  doc.setTextColor(25, 25, 28);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(titulo.toUpperCase(), 14, 44);
  if (subtitulo) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(90, 90, 96);
    doc.text(subtitulo, 14, 50);
  }
}

function novaPagina(doc: jsPDF, titulo: string, subtitulo?: string) {
  doc.addPage();
  desenharTituloSecao(doc, titulo, subtitulo);
  return subtitulo ? 56 : 51;
}

function desenharCabecalhosERodapes(doc: jsPDF, eventoNome: string, tipoChave: string, geradoEm: Date) {
  const total = doc.getNumberOfPages();
  for (let pagina = 1; pagina <= total; pagina++) {
    doc.setPage(pagina);
    doc.setFillColor(15, 15, 18);
    doc.rect(0, 0, LARGURA, 30, "F");
    doc.setFont("helvetica", "bolditalic");
    doc.setFontSize(17);
    doc.setTextColor(239, 68, 68);
    doc.text("// i", 14, 19);
    doc.setTextColor(255, 255, 255);
    doc.text("TATAME", 25, 19);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("KIT DE CONTINGÊNCIA OFFLINE", LARGURA - 14, 13, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(190, 190, 195);
    doc.text(`${tipoChave.toUpperCase()} · ${eventoNome.toUpperCase()}`, LARGURA - 14, 20, { align: "right", maxWidth: 118 });

    doc.setDrawColor(215, 215, 220);
    doc.line(14, ALTURA - 11, LARGURA - 14, ALTURA - 11);
    doc.setFontSize(6.8);
    doc.setTextColor(100, 100, 105);
    doc.text(`Gerado em ${geradoEm.toLocaleDateString("pt-BR")} às ${geradoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`, 14, ALTURA - 6);
    doc.text(`Página ${pagina} de ${total}`, LARGURA - 14, ALTURA - 6, { align: "right" });
  }
}

function desenharCapa(doc: jsPDF, opcoes: OpcoesKit, pendentes: number, concluidas: number) {
  desenharTituloSecao(doc, "Caderno offline do evento", "Uma versão simples para conduzir o campeonato no papel, inclusive no plano Essencial.");
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(210, 214, 220);
  doc.roundedRect(14, 59, 182, 38, 3, 3, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(25, 25, 28);
  doc.text(opcoes.eventoNome.toUpperCase(), 20, 72, { maxWidth: 168 });
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 86);
  doc.text(`${opcoes.tipoChave} · ${opcoes.lutas.length} lutas no arquivo · ${concluidas} concluídas · ${pendentes} pendentes`, 20, 86);
  doc.setFontSize(7.5);
  doc.setTextColor(8, 145, 178);
  doc.text("NÃO EXIGE PAINEL DE MESÁRIO OU CHAMADOR", 20, 92);

  doc.setFillColor(254, 242, 242);
  doc.setDrawColor(248, 113, 113);
  doc.roundedRect(14, 105, 182, 27, 3, 3, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(185, 28, 28);
  doc.text("REGRA ÚNICA", 20, 115);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Durante a instabilidade, escolha o papel como fonte oficial. Não registre a mesma luta ao mesmo tempo no papel e no sistema.", 20, 123, { maxWidth: 168 });

  const passos = [
    ["1", "MARQUE A PRESENÇA", "Na folha do tatame, assinale V e A quando os dois atletas estiverem disponíveis."],
    ["2", "CHAME A LUTA", "Use a ordem impressa. Registre as chamadas e encaminhe os atletas ao tatame."],
    ["3", "ANOTE O RESULTADO", "Preencha vencedor, método e placar na mesma linha. Em seguida atualize a categoria."],
    ["4", "VOLTOU A INTERNET?", "Lance cada resultado no sistema e marque OK. O papel continua arquivado como conferência."],
  ];
  let y = 149;
  passos.forEach(([numero, titulo, descricao]) => {
    doc.setFillColor(15, 15, 18);
    doc.circle(21, y + 3, 5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text(numero, 21, y + 4, { align: "center" });
    doc.setTextColor(25, 25, 28);
    doc.text(titulo, 30, y + 1);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(75, 75, 82);
    doc.text(descricao, 30, y + 7, { maxWidth: 160 });
    y += 25;
  });

  doc.setDrawColor(120, 120, 125);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(45, 45, 50);
  doc.text("Início do uso no papel: ____/____/______  ____:____", 14, 263);
  doc.text("Responsável: __________________________________________", 105, 263);
  doc.text("Retorno ao sistema: ____:____", 14, 274);
  doc.text("Conferido por: _________________________________________", 105, 274);
}

function desenharOperacaoPorTatame(doc: jsPDF, lutas: LutaKitContingencia[], codigo: Map<string, string>) {
  const porTatame = new Map<string, LutaKitContingencia[]>();
  lutas.forEach((luta) => {
    const tatame = texto(luta.tatame, "Tatame a definir");
    porTatame.set(tatame, [...(porTatame.get(tatame) || []), luta]);
  });

  for (const [tatame, lutasTatame] of porTatame) {
    novaPagina(doc, `Folha de operação · ${tatame}`, "Uma linha acompanha toda a luta: presença, chamada, resultado e posterior lançamento no sistema.");
    autoTable(doc, {
      startY: 56,
      head: [["Ordem", "Hora / código", "Atletas", "Presença", "Chamadas", "Resultado", "OK"]],
      body: lutasTatame.map((luta, indice) => {
        const concluida = estaConcluida(luta);
        return [
          String(indice + 1),
          `${formatarHorario(luta.horario_estimado)}\n${codigo.get(String(luta.id)) || "-"}`,
          `V: ${nomeReal(luta.atleta_1)}\nA: ${nomeReal(luta.atleta_2)}\n${grupoDaLuta(luta)}`,
          concluida ? "FEITA" : "V [ ]\nA [ ]",
          concluida ? "-" : "1ª ____:____\n2ª ____:____",
          concluida
            ? `${texto(luta.vencedor)}\n${metodoDaLuta(luta)} · ${placarDaLuta(luta)}`
            : "Vencedor: __________\nMétodo/placar: ________",
          concluida ? "[x]" : "[ ]",
        ];
      }),
      theme: "grid",
      styles: { fontSize: 7.2, cellPadding: 3, valign: "middle", overflow: "linebreak", minCellHeight: 15 },
      headStyles: { fillColor: [24, 24, 27], textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 16, halign: "center", fontStyle: "bold" },
        1: { cellWidth: 23, fontStyle: "bold" },
        2: { cellWidth: 53 },
        3: { cellWidth: 20, halign: "center" },
        4: { cellWidth: 25 },
        5: { cellWidth: 33 },
        6: { cellWidth: 12, halign: "center" },
      },
      margin: { top: TOPO, bottom: RODAPE, left: 14, right: 14 },
      showHead: "everyPage",
      rowPageBreak: "avoid",
    });
  }
}

function desenharCronograma(doc: jsPDF, lutas: LutaKitContingencia[], codigo: Map<string, string>) {
  const porTatame = new Map<string, LutaKitContingencia[]>();
  lutas.forEach((luta) => {
    const tatame = texto(luta.tatame, "Tatame a definir");
    porTatame.set(tatame, [...(porTatame.get(tatame) || []), luta]);
  });

  for (const [tatame, lutasTatame] of porTatame) {
    novaPagina(doc, `Cronograma · ${tatame}`, "Visão mestre da sequência. Resultado atual é impresso; campos manuais ficam disponíveis para a contingência.");
    autoTable(doc, {
      startY: 56,
      head: [["Código", "Hora", "Categoria / fase", "Vermelho", "Azul", "Situação / anotação"]],
      body: lutasTatame.map((luta) => {
        const concluida = estaConcluida(luta);
        return [
          codigo.get(String(luta.id)) || "-",
          formatarHorario(luta.horario_estimado),
          `${grupoDaLuta(luta)}\n${texto(luta.fase, "Fase a definir")}`,
          `${nomeReal(luta.atleta_1)}\n${texto(luta.equipe_1, "")}`,
          `${nomeReal(luta.atleta_2)}\n${texto(luta.equipe_2, "")}`,
          concluida ? `CONCLUÍDA\n${texto(luta.vencedor)} · ${metodoDaLuta(luta)} · ${placarDaLuta(luta)}` : "[ ] chamada  [ ] em luta  [ ] concluída\nVencedor: __________________",
        ];
      }),
      theme: "grid",
      styles: { fontSize: 6.5, cellPadding: 2.2, valign: "middle", overflow: "linebreak" },
      headStyles: { fillColor: [24, 24, 27], textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 0: { cellWidth: 17, fontStyle: "bold" }, 1: { cellWidth: 14 }, 2: { cellWidth: 42 }, 3: { cellWidth: 39 }, 4: { cellWidth: 39 }, 5: { cellWidth: 31 } },
      margin: { top: TOPO, bottom: RODAPE, left: 14, right: 14 },
      showHead: "everyPage",
      rowPageBreak: "avoid",
    });
  }
}

function desenharCheckin(doc: jsPDF, lutas: LutaKitContingencia[]) {
  const inscritos = new Map<string, { nome: string; equipe: string; categoria: string }>();
  lutas.forEach((luta) => {
    [
      { nome: nomeReal(luta.atleta_1), equipe: texto(luta.equipe_1, "-"), categoria: grupoDaLuta(luta) },
      { nome: nomeReal(luta.atleta_2), equipe: texto(luta.equipe_2, "-"), categoria: grupoDaLuta(luta) },
    ].forEach((atleta) => {
      if (atleta.nome === "A DEFINIR") return;
      inscritos.set(`${atleta.nome.toUpperCase()}|${atleta.categoria}`, atleta);
    });
  });
  const atletas = Array.from(inscritos.values()).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  novaPagina(doc, "Check-in e pesagem", "Relação deduplicada a partir das chaves. Marque a situação no papel e informe ausências ao chamador.");
  autoTable(doc, {
    startY: 56,
    head: [["Atleta", "Equipe", "Categoria / faixa", "Presente", "Pesagem", "Apto", "Observação"]],
    body: atletas.map((atleta) => [atleta.nome, atleta.equipe, atleta.categoria, "[ ]", "______ kg", "[ ]", ""]),
    theme: "grid",
    styles: { fontSize: 6.8, cellPadding: 2.8, valign: "middle" },
    headStyles: { fillColor: [30, 64, 175], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [239, 246, 255] },
    columnStyles: { 0: { cellWidth: 39, fontStyle: "bold" }, 1: { cellWidth: 30 }, 2: { cellWidth: 43 }, 3: { cellWidth: 17, halign: "center" }, 4: { cellWidth: 19 }, 5: { cellWidth: 14, halign: "center" }, 6: { cellWidth: 20 } },
    margin: { top: TOPO, bottom: RODAPE, left: 14, right: 14 },
    showHead: "everyPage",
    rowPageBreak: "avoid",
  });
}

function desenharChamador(doc: jsPDF, lutas: LutaKitContingencia[], codigo: Map<string, string>) {
  const porTatame = new Map<string, LutaKitContingencia[]>();
  lutas.filter((luta) => !estaConcluida(luta)).forEach((luta) => {
    const tatame = texto(luta.tatame, "Tatame a definir");
    porTatame.set(tatame, [...(porTatame.get(tatame) || []), luta]);
  });
  for (const [tatame, pendentes] of porTatame) {
    novaPagina(doc, `Chamador e baia · ${tatame}`, "Marque presença somente quando o atleta estiver fisicamente na baia. Uma linha acompanha cada luta pendente.");
    autoTable(doc, {
      startY: 56,
      head: [["Código / hora", "Atletas", "1ª chamada", "2ª chamada", "Na baia", "Liberada", "W.O. / obs."]],
      body: pendentes.map((luta) => [
        `${codigo.get(String(luta.id)) || "-"}\n${formatarHorario(luta.horario_estimado)}`,
        `V: ${nomeReal(luta.atleta_1)}\nA: ${nomeReal(luta.atleta_2)}`,
        "____:____",
        "____:____",
        "V [ ]  A [ ]",
        "____:____",
        "______________",
      ]),
      theme: "grid",
      styles: { fontSize: 7, cellPadding: 3, valign: "middle" },
      headStyles: { fillColor: [8, 145, 178], textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [240, 249, 255] },
      columnStyles: { 0: { cellWidth: 24, fontStyle: "bold" }, 1: { cellWidth: 57 }, 2: { cellWidth: 19 }, 3: { cellWidth: 19 }, 4: { cellWidth: 18 }, 5: { cellWidth: 20 }, 6: { cellWidth: 25 } },
      margin: { top: TOPO, bottom: RODAPE, left: 14, right: 14 },
      showHead: "everyPage",
      rowPageBreak: "avoid",
    });
  }
}

function desenharSumula(doc: jsPDF, luta: LutaKitContingencia, codigoLuta: string, y: number) {
  const x = 14;
  const w = 182;
  const h = 112;
  doc.setDrawColor(90, 90, 95);
  doc.setLineWidth(0.35);
  doc.roundedRect(x, y, w, h, 2, 2);
  doc.setFillColor(24, 24, 27);
  doc.rect(x, y, w, 12, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text(`${codigoLuta} · ${texto(luta.tatame, "Tatame a definir")} · ${formatarHorario(luta.horario_estimado)}`, x + 4, y + 7.5);
  doc.text(texto(luta.fase, "Fase a definir").toUpperCase(), x + w - 4, y + 7.5, { align: "right" });

  doc.setTextColor(35, 35, 40);
  doc.setFontSize(8);
  doc.text(grupoDaLuta(luta).toUpperCase(), x + 4, y + 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(`VERMELHO: ${nomeReal(luta.atleta_1)} · ${texto(luta.equipe_1)}`, x + 4, y + 27, { maxWidth: 174 });
  doc.text(`AZUL: ${nomeReal(luta.atleta_2)} · ${texto(luta.equipe_2)}`, x + 4, y + 35, { maxWidth: 174 });

  const boxY = y + 41;
  const colunas = [
    ["PLACAR", 35], ["PONTOS", 25], ["VANTAGENS", 30], ["PUNIÇÕES", 27], ["TOTAL / OBS.", 65],
  ] as const;
  let cursor = x;
  colunas.forEach(([rotulo, largura]) => {
    doc.rect(cursor, boxY, largura, 22);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.text(rotulo, cursor + largura / 2, boxY + 5, { align: "center" });
    if (rotulo !== "PLACAR") doc.text("V: ____  A: ____", cursor + largura / 2, boxY + 15, { align: "center" });
    else doc.text("VERMELHO × AZUL", cursor + largura / 2, boxY + 15, { align: "center" });
    cursor += largura;
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("VENCEDOR:", x + 4, y + 71);
  doc.setFont("helvetica", "normal");
  doc.text("[ ] Vermelho     [ ] Azul", x + 25, y + 71);
  doc.setFont("helvetica", "bold");
  doc.text("MÉTODO:", x + 78, y + 71);
  doc.setFont("helvetica", "normal");
  doc.text("[ ] Pontos  [ ] Finalização  [ ] Decisão  [ ] W.O.", x + 95, y + 71);
  doc.text("Resultado / observação: __________________________________________________________________________________", x + 4, y + 81);
  doc.text("Início: ____:____    Fim: ____:____    Duração: ________", x + 4, y + 91);
  doc.text("Árbitro: ______________________________", x + 94, y + 91);
  doc.text("Mesário: ______________________________", x + 4, y + 102);
  doc.text("Assinatura do árbitro: ______________________________", x + 94, y + 102);
}

function desenharSumulas(doc: jsPDF, lutas: LutaKitContingencia[], codigo: Map<string, string>) {
  const pendentes = lutas.filter((luta) => !estaConcluida(luta));
  if (pendentes.length === 0) return;
  pendentes.forEach((luta, indice) => {
    if (indice % 2 === 0) novaPagina(doc, "Súmulas manuais", "Duas lutas por página. Entregue a folha preenchida à central de resultados.");
    desenharSumula(doc, luta, codigo.get(String(luta.id)) || "-", indice % 2 === 0 ? 58 : 171);
  });
}

function desenharResultadosPorCategoria(doc: jsPDF, lutas: LutaKitContingencia[], codigo: Map<string, string>) {
  const grupos = new Map<string, LutaKitContingencia[]>();
  lutas.forEach((luta) => grupos.set(grupoDaLuta(luta), [...(grupos.get(grupoDaLuta(luta)) || []), luta]));
  for (const [grupo, lutasGrupo] of grupos) {
    const chaveDeTres = lutasGrupo.some((luta) => texto(luta.fase, "").toUpperCase().includes("CHAVE DE 3"));
    const y = novaPagina(doc, "Controle de resultados", grupo);
    if (chaveDeTres) {
      doc.setFillColor(255, 251, 235);
      doc.setDrawColor(245, 158, 11);
      doc.roundedRect(14, y, 182, 14, 2, 2, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(146, 64, 14);
      doc.text("CHAVE DE 3: vencedor da L1 vai à final; perdedor da L1 enfrenta o terceiro atleta na L2; vencedor da L2 vai à final.", 18, y + 8.5, { maxWidth: 174 });
    }
    autoTable(doc, {
      startY: y + (chaveDeTres ? 19 : 0),
      head: [["Código", "Fase", "Vermelho × Azul", "Vencedor", "Método / placar", "Avança para", "OK"]],
      body: lutasGrupo.sort((a, b) => Number(a.id_visual ?? 9999) - Number(b.id_visual ?? 9999)).map((luta) => {
        const concluida = estaConcluida(luta);
        return [
          codigo.get(String(luta.id)) || "-",
          texto(luta.fase),
          `${nomeReal(luta.atleta_1)}\n× ${nomeReal(luta.atleta_2)}`,
          concluida ? texto(luta.vencedor) : "________________",
          concluida ? `${metodoDaLuta(luta)} · ${placarDaLuta(luta)}` : "________________",
          luta.proxima_luta ? `Luta ${luta.proxima_luta}` : "Pódio",
          concluida ? "[x]" : "[ ]",
        ];
      }),
      theme: "grid",
      styles: { fontSize: 7, cellPadding: 3, valign: "middle" },
      headStyles: { fillColor: [24, 24, 27], textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 0: { cellWidth: 19, fontStyle: "bold" }, 1: { cellWidth: 24 }, 2: { cellWidth: 46 }, 3: { cellWidth: 29 }, 4: { cellWidth: 28 }, 5: { cellWidth: 21 }, 6: { cellWidth: 15, halign: "center" } },
      margin: { top: TOPO, bottom: RODAPE, left: 14, right: 14 },
      showHead: "everyPage",
      rowPageBreak: "avoid",
    });
  }
}

function desenharPodios(doc: jsPDF, lutas: LutaKitContingencia[]) {
  const grupos = Array.from(new Set(lutas.map(grupoDaLuta))).sort((a, b) => a.localeCompare(b, "pt-BR"));
  novaPagina(doc, "Campeões e pódios", "Página oficial de consolidação manual. Confira com as folhas de operação antes da premiação.");
  autoTable(doc, {
    startY: 56,
    head: [["Categoria / faixa", "Ouro", "Prata", "Bronze 1", "Bronze 2", "OK"]],
    body: grupos.map((grupo) => [grupo, "________________", "________________", "________________", "________________", "[ ]"]),
    theme: "grid",
    styles: { fontSize: 7.5, cellPadding: 4, valign: "middle", minCellHeight: 14 },
    headStyles: { fillColor: [202, 138, 4], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [255, 251, 235] },
    columnStyles: { 0: { cellWidth: 45, fontStyle: "bold" }, 1: { cellWidth: 31 }, 2: { cellWidth: 31 }, 3: { cellWidth: 31 }, 4: { cellWidth: 31 }, 5: { cellWidth: 13, halign: "center" } },
    margin: { top: TOPO, bottom: RODAPE, left: 14, right: 14 },
    showHead: "everyPage",
    rowPageBreak: "avoid",
  });
}

function desenharReconciliacao(doc: jsPDF) {
  novaPagina(doc, "Reconciliação e ocorrências", "Use uma linha por alteração feita no papel. Lance no sistema em ordem cronológica quando a conexão voltar.");
  autoTable(doc, {
    startY: 56,
    head: [["Hora", "Código da luta", "Ocorrência / resultado no papel", "Responsável", "Lançado no sistema", "OK"]],
    body: Array.from({ length: 12 }, () => ["____:____", "____________", "", "", "[ ] ____:____", "[ ]"]),
    theme: "grid",
    styles: { fontSize: 7.5, cellPadding: 4, valign: "middle", minCellHeight: 13 },
    headStyles: { fillColor: [127, 29, 29], textColor: [255, 255, 255] },
    columnStyles: { 0: { cellWidth: 20 }, 1: { cellWidth: 27 }, 2: { cellWidth: 67 }, 3: { cellWidth: 30 }, 4: { cellWidth: 28 }, 5: { cellWidth: 10, halign: "center" } },
    margin: { top: TOPO, bottom: RODAPE, left: 14, right: 14 },
  });
  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 260;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(45, 45, 50);
  doc.text("Encerramento da contingência", 14, Math.min(finalY + 10, LIMITE - 12));
  doc.setFont("helvetica", "normal");
  doc.text("Total de lutas no papel: ______    Total lançado: ______    Divergências: ______    Assinatura da coordenação: __________________________", 14, Math.min(finalY + 18, LIMITE - 4));
}

export function criarKitContingenciaPDF(opcoes: OpcoesKit) {
  const geradoEm = opcoes.geradoEm || new Date();
  const lutas = [...opcoes.lutas].sort(ordenarLutas);
  const grupos = Array.from(new Set(lutas.map(grupoDaLuta))).sort((a, b) => a.localeCompare(b, "pt-BR"));
  const indiceGrupo = new Map(grupos.map((grupo, indice) => [grupo, `C${String(indice + 1).padStart(2, "0")}`]));
  const codigo = new Map(lutas.map((luta) => {
    const final = String(luta.id_visual) === "999" || !luta.proxima_luta;
    const sufixo = final ? "F" : `L${texto(luta.id_visual, "-")}`;
    return [String(luta.id), `${indiceGrupo.get(grupoDaLuta(luta))}-${sufixo}`];
  }));
  const concluidas = lutas.filter(estaConcluida).length;
  const pendentes = lutas.length - concluidas;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  desenharCapa(doc, opcoes, pendentes, concluidas);
  desenharOperacaoPorTatame(doc, lutas, codigo);
  desenharResultadosPorCategoria(doc, lutas, codigo);
  desenharPodios(doc, lutas);
  desenharCabecalhosERodapes(doc, opcoes.eventoNome, opcoes.tipoChave, geradoEm);
  return doc;
}
