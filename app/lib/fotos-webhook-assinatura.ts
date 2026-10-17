import { WebhookSignatureValidator } from 'mercadopago';

/** O HMAC usa o ts original; só a conferência de idade normaliza segundos/milissegundos. */
export function validarAssinaturaWebhookFotos({ assinatura, requestId, dataId, secret, agora = Date.now() }: {
  assinatura: string | null; requestId: string | null; dataId: string; secret: string; agora?: number;
}) {
  if (!assinatura || !requestId) throw Error('Assinatura ausente');
  WebhookSignatureValidator.validate({ xSignature: assinatura, xRequestId: requestId, dataId, secret });
  const timestamps = assinatura.split(',').map(parte => parte.trim().split('=')).filter(([chave]) => chave === 'ts');
  if (timestamps.length !== 1) throw Error('Timestamp inválido');
  const ts = Number(timestamps[0][1]);
  const emMs = ts < 1e12 ? ts * 1000 : ts;
  if (!Number.isSafeInteger(ts) || Math.abs(agora - emMs) > 300_000) throw Error('Timestamp fora da tolerância');
}
