import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { LinhaSuporteItatame } from "@/app/lib/super-admin-painel";

export type { LinhaSuporteItatame };

export type LinhaRetratt = {
  organizador: string;
  galerias: string;
  vendas: string;
  comissao: string;
  royaltyAberto: string;
  royaltyDisponivel: string;
  royaltyPago: string;
};

function baixarBlob(nome: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function baixarCsv(nome: string, cabecalhos: string[], linhas: string[][]) {
  const conteudo = [cabecalhos, ...linhas]
    .map((linha) => linha.map((celula) => `"${String(celula ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  baixarBlob(nome, new Blob(["\uFEFF" + conteudo], { type: "text/csv;charset=utf-8;" }));
}

function desenharResumo(doc: jsPDF, resumo: Array<[string, string]>, yInicial: number) {
  doc.setFontSize(8);
  const colunas = 4;
  const largura = 68;
  resumo.forEach(([rotulo, valor], indice) => {
    const coluna = indice % colunas;
    const linha = Math.floor(indice / colunas);
    const x = 14 + coluna * largura;
    const y = yInicial + linha * 10;
    doc.setTextColor(110);
    doc.text(rotulo, x, y);
    doc.setTextColor(20);
    doc.text(valor, x, y + 4);
  });
  return yInicial + Math.ceil(resumo.length / colunas) * 10 + 4;
}

export function exportarPdfSuporte(opcoes: {
  titulo: string;
  subtitulo: string;
  resumo: Array<[string, string]>;
  linhas: LinhaSuporteItatame[];
  nomeArquivo: string;
}) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  doc.setFontSize(16);
  doc.setTextColor(185, 28, 28);
  doc.text(opcoes.titulo, 14, 14);
  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.text(opcoes.subtitulo, 14, 20);
  const inicioTabela = desenharResumo(doc, opcoes.resumo, 28);

  autoTable(doc, {
    startY: inicioTabela,
    theme: "grid",
    styles: { fontSize: 7, cellPadding: 1.6, overflow: "linebreak" },
    headStyles: { fillColor: [24, 24, 27], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    head: [[
      "Organizador",
      "Contato",
      "Plano / MP",
      "Evento",
      "Atleta",
      "Equipe",
      "Categoria",
      "Faixa",
      "Pacote",
      "Valor",
      "Pagamento",
      "Pesagem",
      "ID MP",
    ]],
    body: opcoes.linhas.map((linha) => [
      `${linha.organizador}\n${linha.academia}`,
      linha.contato,
      `${linha.plano}\n${linha.mercadoPago}`,
      `${linha.evento}\n${linha.dataEvento}`,
      linha.atleta,
      linha.equipe,
      linha.categoria,
      `${linha.faixa}\n${linha.peso}`,
      linha.pacote,
      linha.valor,
      linha.pagamento,
      linha.pesagem,
      linha.mercadoPagoId,
    ]),
  });

  doc.save(opcoes.nomeArquivo);
}

export function exportarPdfRetratt(opcoes: {
  subtitulo: string;
  resumo: Array<[string, string]>;
  linhas: LinhaRetratt[];
  nomeArquivo: string;
}) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  doc.setFontSize(16);
  doc.setTextColor(8, 145, 178);
  doc.text("Retratt — financeiro separado do Itatame", 14, 14);
  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.text(opcoes.subtitulo, 14, 20);
  const inicioTabela = desenharResumo(doc, opcoes.resumo, 28);

  autoTable(doc, {
    startY: inicioTabela,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [8, 47, 73], textColor: 255, fontStyle: "bold" },
    head: [["Organizador", "Galerias", "Vendas pagas", "Comissão Itatame", "Royalty em aberto", "Disponível", "Já repassado"]],
    body: opcoes.linhas.map((linha) => [
      linha.organizador,
      linha.galerias,
      linha.vendas,
      linha.comissao,
      linha.royaltyAberto,
      linha.royaltyDisponivel,
      linha.royaltyPago,
    ]),
  });

  doc.save(opcoes.nomeArquivo);
}
