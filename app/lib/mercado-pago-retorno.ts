export function retornoConexaoMercadoPago(status: string | null, motivo: string | null, conectado: boolean) {
  if (status === 'conectado') return conectado
    ? { sucesso: true, mensagem: 'Mercado Pago conectado com sucesso. A autorização foi salva e esta conta está configurada para receber suas vendas.' }
    : { sucesso: false, mensagem: 'Você retornou do Mercado Pago, mas ainda não foi possível confirmar a conexão. Atualize a página e confira novamente.' };
  if (status !== 'erro') return null;
  const mensagens: Record<string, string> = {
    access_denied: 'A autorização no Mercado Pago foi cancelada. Clique no botão para tentar novamente.',
    oauth_invalido: 'O link de autorização é inválido ou expirou. Clique no botão para iniciar novamente.',
    env_mercado_pago: 'A integração do Mercado Pago precisa ser configurada pela equipe da plataforma. Entre em contato com o suporte.',
    token: 'O Mercado Pago não concluiu a autorização. Tente conectar novamente.',
    banco: 'Não foi possível salvar a autorização. Tente conectar novamente; se persistir, fale com o suporte.',
  };
  return { sucesso: false, mensagem: mensagens[motivo || ''] || 'Não foi possível concluir a conexão com o Mercado Pago. Tente novamente.' };
}
