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
    .resize(1200, 1200, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });
  const width = info.width || 1200;
  const height = info.height || 800;
  const tamanhoMarca = Math.max(22, Math.round(width / 18));
  const passoX = Math.max(260, Math.round(width / 2.2));
  const passoY = Math.max(150, Math.round(height / 4.5));
  const marcas: string[] = [];

  for (let y = -height; y <= height * 2; y += passoY) {
    for (let x = -width; x <= width * 2; x += passoX) {
      marcas.push(`<text x="${x}" y="${y}">${escaparXml("RETRATT")}</text>`);
    }
  }

  const barraAltura = Math.min(58, Math.max(42, Math.round(height * 0.07)));
  const overlay = Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <g transform="rotate(-25 ${width / 2} ${height / 2})" fill="#ffffff" fill-opacity="0.22"
         font-family="Arial, sans-serif" font-size="${tamanhoMarca}" font-weight="900"
         text-anchor="middle" dominant-baseline="middle">
        ${marcas.join("")}
      </g>
      <rect x="0" y="${height - barraAltura}" width="${width}" height="${barraAltura}" fill="#000000" fill-opacity="0.66"/>
      <text x="22" y="${height - barraAltura / 2}" fill="#ffffff" fill-opacity="0.94"
        font-family="Arial, sans-serif" font-size="${Math.max(18, Math.round(width / 32))}" font-weight="900"
        dominant-baseline="middle">RETRATT - PRÉVIA PROTEGIDA</text>
    </svg>
  `);

  return sharp(base)
    .composite([{ input: overlay, top: 0, left: 0 }])
    .jpeg({ quality: 82, mozjpeg: true, chromaSubsampling: "4:2:0" })
    .toBuffer();
}
