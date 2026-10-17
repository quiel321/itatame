# Pix, carrinho, e-mails e suporte Retratt — 17/10/2026

A confirmação de um Pix não deve depender de manter o checkout aberto. A consulta somente leitura do caso relatado confirmou aprovação no Mercado Pago antes da confirmação registrada no aplicativo. Não houve reprocessamento desse pagamento real, reenvio de e-mail nem alteração dos dados da compra durante a análise.

## Confirmação pelo servidor

O validador do SDK instalado interpreta o timestamp de tolerância como milissegundos, enquanto notificações assinadas também podem conter segundos. A validação específica da Retratt mantém o HMAC sobre o timestamp original e normaliza a unidade somente para conferir a tolerância de cinco minutos. Identificadores divergentes e assinaturas inválidas continuam rejeitados.

Falhas de consulta, liberação ou envio de e-mail deixam de ser respondidas como erro de assinatura ou confirmação bem-sucedida: o webhook retorna erro temporário para permitir nova tentativa do provedor. Uma notificação repetida pode concluir uma liberação parcial e tentar o e-mail ainda não enviado. A data de pagamento e a validade de downloads já liberados são preservadas; a reserva de e-mail existente impede reenvio quando ele já foi registrado. Toda aprovação continua condicionada à consulta ao Mercado Pago e à correspondência de ID, referência externa e valor.

Referência do HMAC: [documentação oficial de Webhooks](https://www.mercadopago.com.br/developers/en/docs/links-and-debts/additional-content/your-integrations/notifications/webhooks).

## Retorno ao site e carrinho

O navegador mantém o identificador do pedido em processamento, acesso restrito do convidado e IDs das fotos daquele checkout. Não armazena dados do cartão. Ao retornar a qualquer página da Retratt, o acompanhamento consulta o estado autorizado do pedido, inclusive sem login quando há acesso de convidado válido.

Somente a confirmação de pagamento remove as fotos daquele pedido do carrinho atual. Fotos adicionadas depois são preservadas. Falhas de rede mantêm o registro e o carrinho para nova consulta; cancelamento remove o acompanhamento sem retirar fotos não pagas. Compras anteriores também podem ser reconhecidas pela conta autenticada, respeitando a propriedade do pedido e a validade do download. O carregamento do carrinho não restaura itens retirados durante uma consulta simultânea.

O checkout aberto utiliza o mesmo acompanhamento para liberar os links do convidado. O painel do comprador, a lista de compras e o contador da navegação recebem a atualização do carrinho.

## Identidade e suporte

Os dois e-mails específicos de fotos (código de acesso e compra liberada) usam o nome de remetente Retratt, preservando o endereço autorizado configurado. Os e-mails do iTatame e seu webhook não foram alterados.

O site Retratt recebe um botão flutuante com a logo do WhatsApp, no canto inferior direito, para o suporte +55 (65) 99305-9729. O link abre o WhatsApp; nenhuma mensagem é enviada automaticamente.

## Validação

- Assinaturas válidas em segundos e milissegundos; assinatura adulterada e timestamps fora do limite rejeitados.
- Webhook simulado sem navegador: falha parcial, recuperação, falha de e-mail e notificações repetidas, mantendo um único e-mail e as datas anteriores.
- Regras existentes de desconto, distribuição financeira e compra conjunta preservadas nos testes.
- Chrome com chamadas externas simuladas: Pix após recarregar a página, consulta indisponível, remoção somente das fotos pagas, cancelamento, recuperação de compra antiga e links de download do checkout aberto.
- Link, logo e posição do WhatsApp conferidos no celular; nenhum contato real iniciado.
- TypeScript sem erros. Sem mudança de esquema ou migração.

Backups e evidências privadas em `tmp/retratt-pix-retorno-20261017/`.
