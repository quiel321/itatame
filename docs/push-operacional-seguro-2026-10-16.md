# Push operacional seguro — implementação preparada em 16/10/2026

## Situação

Implementação local concluída e verificada. **Ainda não implantada em produção:** a sessão perdeu o acesso de execução SQL ao banco e o mecanismo de navegador deixou de estar disponível. O plugin Supabase foi localizado e sugerido; sua conexão ainda não foi confirmada. Não publicar o frontend antes da migração, pois ele depende das tabelas novas.

Nenhum push foi enviado aos atletas nos testes. Todas as entregas de teste usaram provedor simulado. Nenhum dado do banco real foi alterado nesta preparação. Backup prévio em `tmp/push-seguro-20261016/.env.backup-anterior.json`, com SHA-256; 37 tabelas/views, 1.641 registros, incluindo 14 assinaturas existentes.

## Mudanças

- Destinatários incluem a conta do atleta e `responsavel_id`, sem repetir a mesma conta ou endpoint.
- Nova tabela de dispositivos mantém várias instalações por conta. Assinaturas legadas continuam sendo consultadas, sem migração destrutiva ou exclusão automática.
- A intenção do aviso de check-in/chamada fica na mesma transação do recibo operacional. Repetir o recibo não cria novo aviso.
- Fila com prazo, tentativas limitadas, trava temporária, recibos por aparelho e reenvio somente dos destinos ainda sem confirmação. Notificações substituídas por uma etapa mais nova expiram.
- O serviço de push confirma aceitação pelo provedor, não leitura/exibição física no celular. Uma resposta perdida do provedor pode ocasionar nova tentativa; tag estável no service worker evita empilhar a mesma notificação.
- Horário/tatame são avisados exclusivamente após prévia e confirmação do organizador. Usa somente categorias publicadas, programação salva e inscrição paga ativa. A mesma versão não é reenviada; uma versão pendente que deixou de corresponder à programação atual expira.
- Aprovação de check-in, chamadas, liberação para o tatame e preparação a 15/5 minutos. Preparação exige horário futuro e check-in/despacho liberados.
- Nenhuma reprodução de avisos históricos na migração. A fila começa vazia.
- O processamento é acionado pelas telas operacionais conectadas e pelo pedido explícito do organizador. A fila é durável, mas não há um agendador independente 24h nesta implementação. Avisos vencidos não são enviados ao retornar.
- API exige sessão válida e autorização no evento. Divulgação de programação exige organizador e versão da prévia atual.

## Verificação

Build de produção e TypeScript passaram. Testes com provedor simulado cobrem responsável, múltiplos dispositivos, deduplicação, assinatura inválida, falha parcial e tentativa sem repetir o aparelho já confirmado. Testes da API cobrem autenticação, autorização, prévia sem envio e confirmação/versionamento. Testes da programação cobrem dados não publicados/sem tatame e não repetição.

PostgreSQL local: migração preserva inscrições e não cria avisos antigos; recibo repetido não duplica; nova aprovação do mesmo estado não avisa; reversão atômica também reverte o aviso; trava impede dois processadores; lease vencido pode ser retomado; prazo vencido expira; usuário só cadastra seus aparelhos e não acessa a fila privada.

## Concluir implantação

1. Conectar Supabase ao projeto `sivdvcuggjswfcuzrvgs` ou recuperar a ferramenta autorizada do editor SQL.
2. Executar `tmp/push-seguro-20261016/instalar-preservando-dados.sql`, que instala somente estruturas novas e compara integralmente todas as tabelas anteriores. Verificar dados preservados e fila/entregas com zero registros.
3. Conferir somente leitura a programação atual do Spartan, sem chamar confirmação de envio.
4. Publicar os arquivos específicos desta mudança; conferir o deploy. Não publicar outras alterações locais antigas.
5. Validar uma operação apenas em transação fictícia revertida ou fixture local, com provedor simulado; nunca usar push de atleta real como teste.

A interface fica em Organizar tatames → Avisar atletas sobre horário e tatame → Conferir prévia → Confirmar envio. O botão de confirmação não foi acionado em produção.
