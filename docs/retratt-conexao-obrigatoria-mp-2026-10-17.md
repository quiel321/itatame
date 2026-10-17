# Conexão Mercado Pago no painel do organizador — 17/10/2026

O painel Retratt abre um diálogo obrigatório quando o organizador ainda não vinculou sua conta Mercado Pago à Retratt. O botão inicia o fluxo OAuth existente com o perfil `organizador_fotos`. O usuário pode conectar, conferir novamente uma conexão feita em outra janela ou sair da conta. Escape e cliques fora do diálogo não liberam o painel; o foco de teclado fica dentro dele.

O aviso explica que a seleção Diária só é salva depois da conexão e que, ao voltar da autorização, é necessário selecionar e salvar o modelo para cada fotógrafo. Conectar não altera automaticamente o modelo de recebimento nem grava configurações financeiras.

A consulta diferencia conta ausente de erro de leitura. Em caso de falha, o diálogo permite verificar novamente e não afirma que a conta está desconectada. A presença da conexão exige data de vínculo, credencial e chave pública no cadastro próprio de recebimentos da Retratt. Somente um booleano é retornado ao navegador; credenciais permanecem no servidor.

Uma tentativa de salvar Diária sem conta apta continua bloqueada no servidor, antes de qualquer UPDATE. A resposta 409 inclui `MP_CONEXAO_NECESSARIA` e o texto “Diária não salva”. O painel abre o diálogo e exibe a falha junto à configuração do fotógrafo. Rascunhos diferentes do modelo salvo mostram “Alterações não salvas”; sucesso só aparece após a resposta de confirmação do servidor. Falhas de rede não repetem automaticamente a gravação.

## Validação

- Testes de API: autenticação, conta ausente, recusa sem gravação, conta conectada, credenciais incompletas, erro de consulta e ausência de credenciais na resposta.
- Testes existentes de retorno OAuth e compra conjunta preservados.
- TypeScript sem erros.
- Chrome com dados e OAuth simulados: popup obrigatório, foco, Escape, cancelamento, erro HTTP, retorno autorizado, verificação manual, rascunho preservado e salvamento individual.
- Layout conferido no desktop e em celulares com 390 e 320 px, sem cortes.

Não houve alteração de conta Mercado Pago, credenciais, galerias, recebimentos, vendas ou dados reais durante a validação. Os backups e as evidências privadas ficam em `tmp/retratt-mp-obrigatorio-20261017/` e não são publicados.
