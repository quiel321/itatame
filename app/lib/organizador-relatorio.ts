import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { inscricaoCortesia, textoCupomInscricao, valorLiquidoInscricao, type DadosFinanceirosInscricao } from "./inscricao-relatorio";

type InscricaoRelatorio = DadosFinanceirosInscricao & {
  id: string | number; atleta?: string | null; equipe?: string | null;
  categoria?: string | null; faixa?: string | null; peso?: string | number | null; pesagem_ok?: boolean | null;
};

export function exportarPdfOrganizador(inscricoes: InscricaoRelatorio[]) {
  const doc = new jsPDF("landscape");
  doc.setFontSize(18); doc.setTextColor(220, 38, 38);
  doc.text("ITATAME - LISTA DE ATLETAS", 14, 16);
  doc.setFontSize(9); doc.setTextColor(100);
  doc.text("Relatório gerado em " + new Date().toLocaleDateString("pt-BR") + ". Total de inscrições: " + inscricoes.length, 14, 23);
  doc.setFontSize(8);
  doc.text("Valor líquido após desconto. Cortesia = inscrição liberada sem cobrança.", 14, 29);
  const moeda = (valor: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);
  autoTable(doc, {
    head: [["Nº inscrição", "Atleta", "Equipe", "Categoria", "Faixa", "Peso", "Valor líquido", "Cupom / Desconto", "Situação", "Pesagem"]],
    body: inscricoes.map(item => [String(item.id), item.atleta || "N/A", item.equipe || "N/A", item.categoria || "N/A", item.faixa || "N/A", item.peso ? item.peso + " KG" : "Abs.", moeda(valorLiquidoInscricao(item)), textoCupomInscricao(item), inscricaoCortesia(item) ? "CORTESIA" : item.pagamento_ok ? "PAGO" : "PENDENTE", item.pesagem_ok ? "OK" : "PEND."]),
    startY: 35, theme: "grid", margin: 14,
    styles: { fontSize: 7.5, cellPadding: 2, overflow: "linebreak" },
    headStyles: { fillColor: [20, 20, 20], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [240, 240, 240] },
    columnStyles: { 0: { cellWidth: 13 }, 1: { cellWidth: 40 }, 2: { cellWidth: 26 }, 3: { cellWidth: 54 }, 4: { cellWidth: 15 }, 5: { cellWidth: 13 }, 6: { cellWidth: 20 }, 7: { cellWidth: 43 }, 8: { cellWidth: 24 }, 9: { cellWidth: 21 } },
  });
  doc.save("relatorio_iTatame_" + new Date().toISOString().slice(0, 10) + ".pdf");
}
