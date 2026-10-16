# Push no Chrome Android — 16/10/2026

## Evidência e limite do diagnóstico

O lote do Spartan das 12h30 de Cuiabá teve 56 avisos: 18 aceitos pelo provedor e 38 sem assinatura válida disponível. Para o atleta consultado, o endpoint aceito corresponde à ativação cadastrada às 12h11, com uma tentativa e sem erro registrado. Isso não comprova exibição física no aparelho. Não houve reenvio desse aviso durante a investigação.

O envio usava a prioridade padrão `normal`. Ela passa a `high` nos avisos operacionais, solicitando entrega imediata ao serviço, sem prometer contornar permissões, configurações do aparelho ou economia de bateria. Referência: https://web.dev/articles/push-notifications-web-push-protocol

## Mudanças

- Ativação e teste aguardam a nova versão do service worker ativar, sem cache da atualização e com espera limitada.
- O worker tolera payload malformado e tenta uma exibição simplificada se as opções/imagem falharem. Usa o PNG já disponível em `/apple-icon`.
- Perfil → Alertas no Celular informa o estado da ativação neste navegador e permite um teste solicitado explicitamente pelo usuário.
- O teste autentica a conta, exige confirmação e usa apenas o endpoint deste navegador, já vinculado à própria conta. Não aceita atleta/evento/destinatário arbitrário nem mensagem personalizada.
- Teste com TTL de dois minutos, sem fila do campeonato ou repetição automática. A interface limita a repetição por 30 segundos, com limitação adicional por instância no servidor; não se apresenta como limite global distribuído.
- Assinatura rejeitada como expirada oferece reativação mediante clique. Não exclui assinaturas do banco. O restante dos aparelhos da conta permanece preservado.
- Mensagem de resultado diferencia envio aceito de exibição. Ajuda para permissões do site/Chrome/Android fica no próprio popup.
- Mensagens do responsável e dos dependentes mantêm identificação por atleta e tag distinta por aviso.

## Segurança dos dados e validação

Nenhuma alteração de schema, cadastro, inscrição, luta ou resultado é necessária. Nenhuma notificação real é enviada pelo agente durante os testes. Assinaturas e histórico de envios anteriores não são apagados nem reprocessados. Backup dos três arquivos anteriores em `tmp/push-android-20261016/antes/`.

Testes com provedor simulado: exibição com fallback, payload inválido, destino interno, ativação do worker, aparelho offline, renovação explícita, autenticação, isolamento de contas/aparelhos, confirmação obrigatória, expiração, ausência de repetição automática e responsável com dois dependentes. As confirmações de recebimento/leitura e a central de avisos permanecem melhorias futuras.

O diagnóstico do caso concreto depende de o usuário atualizar o site e tocar em **Testar aviso neste aparelho** no próprio Chrome Android. Se o teste for aceito e continuar invisível, verificar permissões do site e do Chrome no Android e a barra de notificações. Referência: https://support.google.com/chrome/answer/3220216?co=GENIE.Platform%3DAndroid&hl=pt-BR
