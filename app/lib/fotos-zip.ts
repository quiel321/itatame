import { createHmac, timingSafeEqual } from 'node:crypto';

const LIMITE_ZIP = 2 * 1024 * 1024 * 1024;
const tabelaCrc = Array.from({ length: 256 }, (_, n) => {
  for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
function assinatura(pedidoId: string, exp: number) {
  const secret = process.env.FOTOS_ACESSO_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error('Download indisponível.');
  return createHmac('sha256', secret).update(`retratt-download-zip-v1:${pedidoId}:${exp}`).digest('base64url');
}
export function linkZipPedido(pedidoId: string) {
  const exp = Math.floor(Date.now() / 1000) + 300;
  return `/api/fotos/download-pedido/${pedidoId}?` + new URLSearchParams({ exp: String(exp), assinatura: assinatura(pedidoId, exp) });
}
export function acessoZipValido(pedidoId: string, exp: string | null, valor: string | null) {
  const prazo = Number(exp), agora = Date.now() / 1000;
  if (!valor || !Number.isSafeInteger(prazo) || prazo < agora || prazo > agora + 305) return false;
  const a = Buffer.from(assinatura(pedidoId, prazo)), b = Buffer.from(valor);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function nomeFotoZip(nome: string | null, indice: number, id: string) {
  const seguro = (nome || `foto-${id}.jpg`).replace(/[\x00-\x1f\x7f<>:"/\\|?*]/g, '-').replace(/^\.+/, '').slice(0, 160) || 'foto.jpg';
  return `${String(indice + 1).padStart(3, '0')}-${seguro}`;
}

type EntradaZip = { nome: string; abrir: (signal: AbortSignal) => Promise<Response> };
/** ZIP sem recomprimir JPEGs: envia um arquivo por vez e respeita a pressão do navegador. */
export function criarZipFotos(entradas: EntradaZip[], signal?: AbortSignal) {
  const abortar = new AbortController();
  const cancelar = () => abortar.abort();
  signal?.addEventListener('abort', cancelar, { once: true });
  if (signal?.aborted) cancelar();
  async function* gerar() {
    const centrais: Buffer[] = [];
    let offset = 0;
    try {
      if (!entradas.length || entradas.length > 500) throw new Error('Quantidade de fotos inválida.');
      for (const entrada of entradas) {
        abortar.signal.throwIfAborted();
        const arquivo = await entrada.abrir(abortar.signal);
        if (!arquivo.ok || !arquivo.body) throw new Error('Uma foto está indisponível. Tente baixar novamente.');
        const nome = Buffer.from(entrada.nome, 'utf8'), inicio = offset;
        if (offset + Number(arquivo.headers.get('content-length') || 0) > LIMITE_ZIP) {
          await arquivo.body.cancel(); throw new Error('O ZIP ultrapassa 2 GB. Use os downloads individuais.');
        }
        const cab = Buffer.alloc(30 + nome.length);
        cab.writeUInt32LE(0x04034b50, 0); cab.writeUInt16LE(20, 4); cab.writeUInt16LE(0x0808, 6);
        cab.writeUInt16LE(0x21, 12); cab.writeUInt16LE(nome.length, 26); nome.copy(cab, 30);
        offset += cab.length; yield cab;
        let crc = 0xffffffff, tamanho = 0;
        const reader = arquivo.body.getReader();
        try {
          while (true) {
            abortar.signal.throwIfAborted();
            const { value, done } = await reader.read(); if (done) break;
            tamanho += value.byteLength; offset += value.byteLength;
            if (offset > LIMITE_ZIP) throw new Error('O ZIP ultrapassa 2 GB. Use os downloads individuais.');
            for (const byte of value) crc = tabelaCrc[(crc ^ byte) & 255] ^ (crc >>> 8);
            yield value;
          }
        } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
        crc = (crc ^ 0xffffffff) >>> 0;
        const fim = Buffer.alloc(16);
        fim.writeUInt32LE(0x08074b50, 0); fim.writeUInt32LE(crc, 4); fim.writeUInt32LE(tamanho, 8); fim.writeUInt32LE(tamanho, 12);
        offset += fim.length; yield fim;
        const central = Buffer.alloc(46 + nome.length);
        central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x0808, 8);
        central.writeUInt16LE(0x21, 14); central.writeUInt32LE(crc, 16); central.writeUInt32LE(tamanho, 20); central.writeUInt32LE(tamanho, 24);
        central.writeUInt16LE(nome.length, 28); central.writeUInt32LE(inicio, 42); nome.copy(central, 46); centrais.push(central);
      }
      const inicioCentral = offset;
      for (const central of centrais) { offset += central.length; yield central; }
      const fim = Buffer.alloc(22);
      fim.writeUInt32LE(0x06054b50, 0); fim.writeUInt16LE(entradas.length, 8); fim.writeUInt16LE(entradas.length, 10);
      fim.writeUInt32LE(offset - inicioCentral, 12); fim.writeUInt32LE(inicioCentral, 16); yield fim;
    } finally { signal?.removeEventListener('abort', cancelar); abortar.abort(); }
  }
  const iterador = gerar();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try { const r = await iterador.next(); if (r.done) controller.close(); else controller.enqueue(r.value); }
      catch (erro) { controller.error(erro); }
    },
    async cancel() { abortar.abort(); await iterador.return(); },
  });
}
