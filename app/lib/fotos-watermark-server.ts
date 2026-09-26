import sharp from "sharp";

export async function gerarPreviewProtegidaRetratt(source: Buffer) {
  const { data: base, info } = await sharp(source, { failOn: "none" })
    .rotate()
    .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });
  const width = info.width || 1200;
  const height = info.height || 800;
  const escala = Math.min(width, height);
  const tamanhoMarca = Math.max(32, Math.round(escala * 0.105));
  const tamanhoSecundario = Math.max(13, Math.round(tamanhoMarca * 0.25));
  const barraAltura = Math.max(32, Math.round(escala * 0.055));
  const marcas = [0.2, 0.5, 0.8].flatMap((y) => [0.25, 0.75].map((x) =>
    `<text x="${Math.round(width * x)}" y="${Math.round(height * y)}">RETRATT</text>`,
  ));
  const overlay = Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <g fill="#ffffff" fill-opacity="0.18" stroke="#000000" stroke-opacity="0.1"
         stroke-width="2" paint-order="stroke" font-family="Arial, sans-serif"
         font-size="${tamanhoSecundario}" font-weight="800" letter-spacing="2"
         text-anchor="middle" dominant-baseline="middle">
        ${marcas.join("")}
      </g>
      <text x="${width / 2}" y="${height / 2}" fill="#ffffff" fill-opacity="0.48"
        stroke="#000000" stroke-opacity="0.35" stroke-width="${Math.max(2, Math.round(escala * 0.005))}"
        paint-order="stroke" font-family="Arial, sans-serif" font-size="${tamanhoMarca}"
        font-weight="900" letter-spacing="${Math.max(2, Math.round(escala * 0.008))}"
        text-anchor="middle" dominant-baseline="middle">RETRATT</text>
      <rect x="0" y="${height - barraAltura}" width="${width}" height="${barraAltura}" fill="#000000" fill-opacity="0.65"/>
      <rect x="0" y="${height - barraAltura}" width="${width}" height="2" fill="#ff5a1f" fill-opacity="0.8"/>
      <text x="${width / 2}" y="${height - barraAltura / 2}" fill="#ffffff" fill-opacity="0.9"
        font-family="Arial, sans-serif" font-size="${Math.max(11, Math.round(escala * 0.019))}" font-weight="700"
        letter-spacing="2" text-anchor="middle" dominant-baseline="middle">PRÉVIA PROTEGIDA · RETRATT</text>
    </svg>
  `);

  return sharp(base)
    .composite([{ input: overlay, top: 0, left: 0 }])
    .jpeg({ quality: 82, mozjpeg: true, chromaSubsampling: "4:2:0" })
    .toBuffer();
}
