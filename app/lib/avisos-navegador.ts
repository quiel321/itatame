/** Atualiza o worker antes de ativar/testar; evita ficar aguardando indefinidamente. */
export async function prepararRegistroAvisos() {
  if (!('serviceWorker' in navigator)) throw new Error('Este navegador não oferece avisos.');
  if (!navigator.onLine) throw new Error('Conecte este aparelho à internet e tente novamente.');
  let timer: ReturnType<typeof setTimeout> | undefined;
  let encerrarEspera: (() => void) | undefined;
  const preparar = async () => {
    const registro = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
    const worker = registro.installing || registro.waiting;
    if (worker && worker.state !== 'activated') {
      await new Promise<void>((resolve, reject) => {
        const conferir = () => {
          if (worker.state === 'activated' || worker.state === 'redundant') {
            worker.removeEventListener('statechange', conferir);
            if (worker.state === 'activated') resolve();
            else reject(new Error('Atualização dos avisos interrompida. Reabra a página e tente novamente.'));
          }
        };
        encerrarEspera = () => worker.removeEventListener('statechange', conferir);
        worker.addEventListener('statechange', conferir);
        conferir();
      });
    }
    if (!registro.active) throw new Error('Os avisos ainda estão iniciando. Reabra a página e tente novamente.');
    return registro;
  };
  try {
    return await Promise.race([
      preparar(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Não foi possível preparar os avisos agora. Confira a conexão e tente novamente.')), 15000); }),
    ]);
  } finally { clearTimeout(timer); encerrarEspera?.(); }
}

export async function assinaturaNesteAparelho(registro: ServiceWorkerRegistration, vapid: string, renovar = false) {
  let assinatura = await registro.pushManager.getSubscription();
  // Somente após o usuário pedir reativação de uma assinatura informada como expirada.
  // As assinaturas antigas no banco são preservadas.
  if (renovar && assinatura) { await assinatura.unsubscribe(); assinatura = null; }
  if (!assinatura) {
    const base64 = (vapid + '='.repeat((4 - vapid.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/');
    assinatura = await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: Uint8Array.from(atob(base64), char => char.charCodeAt(0)) });
  }
  return assinatura;
}
