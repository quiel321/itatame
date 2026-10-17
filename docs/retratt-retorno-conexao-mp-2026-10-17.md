# Confirmação do retorno da conexão Mercado Pago

Ao revisar uma conta já autorizada, o Mercado Pago pode retornar imediatamente ao painel. O callback já salvava as credenciais e redirecionava com `mp=conectado`, mas o botão/painel não apresentava o resultado, dando a impressão de que nada havia acontecido.

O botão compartilhado agora reconhece esse retorno e exibe confirmação quando o painel também reconhece a conta como conectada. Caso a conta não esteja reconhecida, orienta conferir novamente. Explica cancelamento, link inválido/expirado, erro de configuração e falha para salvar, sem reproduzir conteúdo arbitrário da URL. O painel rola até a mensagem e remove apenas os parâmetros de resultado (`mp` e `motivo`), preservando os demais parâmetros e o fragmento.

O pedido para iniciar a autorização tem prazo de 20 segundos e mensagem para timeout. Erros HTTP ou respostas inválidas ficam visíveis e permitem tentar novamente. O modo diária mostra que a conta já está conectada e explica por que a revisão pode retornar direto ao painel.

Não foram alterados callback, credenciais, OAuth, contas recebedoras, regras de venda, dados de campeonato ou pedidos. A alteração limita-se à apresentação do resultado e tratamento da resposta no botão.

Verificação: dois testes unitários do retorno, TypeScript sem erros e Chrome/Playwright com dados e autorização simulados. Casos: clicar/recarregar/voltar com sucesso, mensagem visível, preservação de parâmetros, erro HTTP, recuperação do botão e cancelamento no celular sem overflow. Nenhum OAuth, pagamento ou alteração de conta real foi executado pelos testes.

Backup e provas privados: `tmp/retratt-mp-retorno-20261017/`.
