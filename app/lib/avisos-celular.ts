export const ADIAMENTO_AVISOS_MS = 7 * 24 * 60 * 60 * 1000;

export function deveConvidarAvisos(dados: {
  role: string; suportado: boolean; permissao: string;
  assinaturaNoNavegador: boolean; assinaturaNaConta: boolean; adiadoAte: number; agora?: number;
}) {
  return ['atleta', 'professor'].includes(dados.role) && dados.suportado
    && !(dados.permissao === 'granted' && dados.assinaturaNoNavegador && dados.assinaturaNaConta)
    && dados.adiadoAte <= (dados.agora ?? Date.now());
}

export function assinaturaCorresponde(raw: unknown, endpoint: string) {
  try {
    const assinatura = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return typeof assinatura === 'object' && assinatura !== null && 'endpoint' in assinatura && assinatura.endpoint === endpoint;
  } catch { return false; }
}
