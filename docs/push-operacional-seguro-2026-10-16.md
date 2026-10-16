# Push operacional seguro — implantação de 16/10/2026

## Situação

Migrações aditivas instaladas em produção pelo conector Supabase: `push_operacao_responsaveis_programacao` e `push_politicas_privadas_explicitas`. A instalação comparou integralmente as tabelas anteriores na mesma transação e confirmou a preservação dos registros. As novas tabelas têm RLS e permissões explícitas; fila, entregas e processamento são privados do servidor. Publicação do frontend ocorre somente após essa instalação.

Nenhum push foi enviado aos atletas nos testes. Todas as entregas de teste usaram provedor simulado. Nenhum registro anterior do campeonato foi alterado. Backup prévio em `tmp/push-seguro-20261016/.env.backup-anterior.json`, com SHA-256; 37 tabelas/views, 1.641 registros, incluindo 14 assinaturas existentes.

## Mudanças

- Destinatários incluem a conta do atleta e `responsavel_id`, sem repetir a mesma conta ou endpoint.
- Nova tabela de dispositivos mantém várias instalações por conta. Assinaturas legadas continuam sendo consultadas, sem migração destrutiva ou exclusão automática.
- A intenção do aviso de check-in/chamada fica na mesma transação do recibo operacional. Repetir o recibo não cria novo aviso.
- Fila com prazo, tentativas limitadas, trava temporária, recibos por aparelho e reenvio somente dos destinos ainda sem confirmação. Notificações substituídas por uma etapa mais nova expiram.
- O serviço de push confirma aceitação pelo provedor, não leitura/exibição física no celular. Uma resposta perdida do provedor pode ocasionar nova tentativa; tag estável no service worker evita empilhar a mesma notificação.
- Horário/tatame são avisados exclusivamente após prévia e confirmação do organizador. Usa somente categorias publicadas, programação salva e inscrição paga ativa. A mesma versão não é reenviada; uma versão pendente que deixou de corresponder à programação atual expira.
- Inscrições de absoluto sem `categoria_id` usam o mesmo enquadramento da geração das chaves. Isso inclui as 13 inscrições de absoluto do Spartan sem editar os cadastros.
- Aprovação de check-in, chamadas, liberação para o tatame e preparação a 15/5 minutos. Preparação exige horário futuro e check-in/despacho liberados.
- Nenhuma reprodução de avisos históricos na migração. A fila começa vazia.
- O processamento é acionado pelas telas operacionais conectadas e pelo pedido explícito do organizador. A fila é durável, mas não há um agendador independente 24h nesta implementação. Avisos vencidos não são enviados ao retornar.
- API exige sessão válida e autorização no evento. Divulgação de programação exige organizador e versão da prévia atual.

## Verificação

Build de produção e TypeScript passaram. Testes com provedor simulado cobrem responsável, múltiplos dispositivos, deduplicação, assinatura inválida, falha parcial e tentativa sem repetir o aparelho já confirmado. Testes da API cobrem autenticação, autorização, prévia sem envio e confirmação/versionamento. Testes da programação cobrem dados não publicados/sem tatame e não repetição.

PostgreSQL local: migração preserva inscrições e não cria avisos antigos; recibo repetido não duplica; nova aprovação do mesmo estado não avisa; reversão atômica também reverte o aviso; trava impede dois processadores; lease vencido pode ser retomado; prazo vencido expira; usuário só cadastra seus aparelhos e não acessa a fila privada.

## Verificação em produção

- Prévia somente leitura: 56 avisos possíveis, nenhum já registrado e nenhuma inscrição sem programação futura completa no momento da conferência. Isso não significa 56 aparelhos habilitados.
- Teste de integração no evento fictício, em subtransação intencionalmente revertida: recibo cria um aviso, repetição não duplica e reversão remove ambos. Nenhuma ação de check-in ou luta foi executada.
- Após o teste, fila e entregas permaneceram vazias. As 14 assinaturas legadas foram preservadas.
- Nenhum alerta dos assessores de segurança faz referência às novas estruturas.
- Os arquivos desta mudança são publicados isoladamente, preservando as demais alterações antigas do checkout.

A interface fica em Organizar tatames → Avisar atletas sobre horário e tatame → Conferir prévia → Confirmar envio. O botão de confirmação não foi acionado em produção.
