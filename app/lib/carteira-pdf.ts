import { jsPDF } from "jspdf";

export type DadosCarteiraPdf = {
  nome: string; nascimento: string; faixa: string; equipe: string; academia: string;
  professor: string; modalidade: string; registro: string; mestre: boolean;
  perfilUrl: string; foto?: string; qrCode: string;
};

/** Frente e verso em tamanho de cartão (85,6 x 54 mm), numa folha A4. */
export function gerarCarteiraPdf(dados: DadosCarteiraPdf) {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const x = 20, y = 30, w = 85.6, h = 54, versoX = x + w + 8;
  const texto = (valor: string, px: number, py: number, largura: number, tamanho = 8, linhas = 2) => {
    pdf.setFontSize(tamanho);
    const partes = pdf.splitTextToSize(valor || "Não informado", largura) as string[];
    const visiveis = partes.slice(0, linhas);
    if (partes.length > linhas) visiveis[linhas - 1] = visiveis[linhas - 1].replace(/.{3}$/, "...");
    pdf.text(visiveis, px, py);
  };
  const moldura = (px: number, titulo: string) => {
    pdf.setDrawColor(130); pdf.setLineWidth(0.2); pdf.rect(px, y, w, h);
    pdf.setFillColor(20, 22, 27); pdf.rect(px, y, w, 10, "F");
    pdf.setTextColor(255); pdf.setFont("helvetica", "bold"); pdf.setFontSize(11);
    pdf.text("iTATAME", px + 4, y + 6.5);
    pdf.setFontSize(6); pdf.text(titulo, px + w - 4, y + 6.5, { align: "right" });
    pdf.setTextColor(35); pdf.setFont("helvetica", "normal");
  };
  moldura(x, dados.mestre ? "CARTEIRA DO MESTRE" : "CARTEIRA DO ATLETA");
  if (dados.foto) pdf.addImage(dados.foto, "JPEG", x + 4, y + 14, 20, 26);
  else { pdf.setFillColor("#ebebeb"); pdf.rect(x + 4, y + 14, 20, 26, "F"); pdf.setFontSize(22); pdf.text(dados.nome.charAt(0).toUpperCase(), x + 14, y + 30, { align: "center" }); }
  pdf.setFont("helvetica", "bold"); texto(dados.nome, x + 28, y + 17, 53, 9, 2);
  pdf.setFont("helvetica", "normal");
  texto("Nascimento: " + (dados.nascimento || "Não informado"), x + 28, y + 29, 53, 7, 1);
  texto("Faixa: " + (dados.faixa || "Não informada"), x + 28, y + 35, 53, 7, 1);
  texto(dados.modalidade || "Jiu-Jitsu", x + 28, y + 41, 53, 7, 1);
  pdf.setFontSize(6); pdf.text("Registro: " + dados.registro, x + 4, y + 49);
  pdf.text("Validade: 31/12/" + new Date().getFullYear(), x + w - 4, y + 49, { align: "right" });
  moldura(versoX, "IDENTIFICAÇÃO E VÍNCULO");
  texto("Equipe: " + (dados.equipe || "Sem equipe"), versoX + 4, y + 16, 51, 7, 2);
  texto("Academia: " + (dados.academia || "Não informada"), versoX + 4, y + 27, 51, 7, 2);
  if (!dados.mestre) texto("Professor: " + (dados.professor || "Não informado"), versoX + 4, y + 38, 51, 7, 2);
  pdf.addImage(dados.qrCode, "PNG", versoX + 59, y + 17, 22, 22);
  pdf.link(versoX + 59, y + 17, 22, 22, { url: dados.perfilUrl });
  pdf.setFontSize(6); pdf.text("Perfil público", versoX + 70, y + 43, { align: "center" });
  pdf.text("itatame.com.br", versoX + 4, y + 49);
  pdf.setTextColor(90); pdf.setFontSize(9); pdf.text("Carteira iTatame - frente e verso", x, 18);
  pdf.setFontSize(8); pdf.text("Imprima em tamanho real (100%). Recorte pelas bordas. Cada face mede 85,6 x 54 mm.", x, y + h + 10);
  return pdf;
}

