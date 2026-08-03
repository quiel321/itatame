import sharp from "sharp";

function escaparXml(valor: string) {
  return valor.replace(/[<>&"']/g, (caractere) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    '"': "&quot;",
    "'": "&apos;",
  })[caractere] || caractere);
}

export async function gerarPreviewProtegidaRetratt(source: Buffer) {
  const { data: base, info } = await sharp(source, { failOn: "none" })
    .rotate()
    .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });
  const width = info.width || 1200;
  const height = info.height || 800;
  const tamanhoMarca = Math.max(14, Math.round(width / 48));
  const passoX = Math.max(220, Math.round(width / 2.4));
  const passoY = Math.max(120, Math.round(height / 5));
  const marcas: string[] = [];

  for (let y = -height; y <= height * 2; y += passoY) {
    for (let x = -width; x <= width * 2; x += passoX) {
      marcas.push(`<rect x="${x - 210}" y="${y - 18}" width="420" height="36" rx="18" fill="#000000" fill-opacity="0.58"/>`);
      marcas.push(`<text x="${x}" y="${y}">${escaparXml("RETRATT • REPRODUÇÃO NÃO AUTORIZADA")}</text>`);
    }
  }

  const passoGrade = Math.max(58, Math.round(width / 13));
  const segmento = Math.max(26, Math.round(passoGrade * 0.62));
  const linhas: string[] = [];
  for (let y = -passoGrade; y < height + passoGrade; y += passoGrade) {
    for (let x = -passoGrade; x < width + passoGrade; x += passoGrade) {
      linhas.push(`<path d="M ${x} ${y} L ${x + segmento} ${y + segmento}" stroke="#ffffff" stroke-opacity="0.58" stroke-width="2"/>`);
      linhas.push(`<path d="M ${x + segmento} ${y} L ${x} ${y + segmento}" stroke="#ff5a1f" stroke-opacity="0.48" stroke-width="2"/>`);
    }
  }

  const barraAltura = Math.min(82, Math.max(58, Math.round(height * 0.1)));
  const overlay = Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <g>${linhas.join("")}</g>
      <g transform="rotate(-20 ${width / 2} ${height / 2})" fill="#ffffff" fill-opacity="0.96"
         font-family="Arial, sans-serif" font-size="${tamanhoMarca}" font-weight="900"
         text-anchor="middle" dominant-baseline="middle">
        ${marcas.join("")}
      </g>
      <rect x="0" y="${height - barraAltura}" width="${width}" height="${barraAltura}" fill="#000000" fill-opacity="0.84"/>
      <rect x="0" y="${height - barraAltura}" width="${width}" height="3" fill="#ff5a1f" fill-opacity="0.9"/>
      <text x="${width / 2}" y="${height - barraAltura * 0.63}" fill="#ffffff"
        font-family="Arial, sans-serif" font-size="${Math.max(15, Math.round(width / 43))}" font-weight="900"
        text-anchor="middle" dominant-baseline="middle">COMPARTILHAR SEM AUTORIZAÇÃO É ILEGAL</text>
      <text x="${width / 2}" y="${height - barraAltura * 0.28}" fill="#ff5a1f"
        font-family="Arial, sans-serif" font-size="${Math.max(11, Math.round(width / 62))}" font-weight="800"
        text-anchor="middle" dominant-baseline="middle">COMPRE O ARQUIVO ORIGINAL • VALORIZE O FOTÓGRAFO</text>
    </svg>
  `);

  return sharp(base)
    .composite([{ input: overlay, top: 0, left: 0 }])
    .jpeg({ quality: 82, mozjpeg: true, chromaSubsampling: "4:2:0" })
    .toBuffer();
}
