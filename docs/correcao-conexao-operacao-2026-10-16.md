# Recuperação da conexão na operação

Relato: no Chrome do celular, após acompanhar o ao vivo e voltar ao início, campeonatos e login deixavam de responder até encerrar o navegador e limpar o armazenamento. Sem diagnóstico do aparelho durante a falha, a causa específica do episódio não foi comprovada.

Correções:

- Requisições REST e Auth têm limite de 20 segundos, incluindo leitura do corpo. Interrupções transitórias na renovação são tratadas pelo SDK sem apagar a sessão. Uploads/downloads de fotos mantêm seu comportamento.
- Navbar aguarda inicialização e agenda consultas fora da notificação de autenticação, evitando consultas encadeadas sob o bloqueio da sessão.
- Início diferencia carregamento, falha e resultado vazio; preserva eventos já carregados e tenta novamente ao recuperar foco/conexão.
- Recepção, chamada e painel do mesário recebem sinal de recuperação; o placar em andamento permanece montado. Verificação de conectividade não reenvia resultados.
- Pontos são gravados na ordem por lado. Falhas ficam visíveis e o operador pode salvar o placar atual explicitamente. Atualizações não alteram confrontos concluídos. Antes do resultado final, as gravações de pontos anteriores terminam.
- O service worker não substitui uma navegação offline por uma cópia antiga da página inicial. Não remove sessões, inscrições ou caches existentes.

Validação: seis testes de transporte/SDK, cinco testes de despacho/ao vivo, TypeScript e build. SDK real com armazenamento fictício, token perto de expirar e primeira renovação sem resposta recuperou consultas e login. Navegador com backend local: HTTP 503 na recepção/início, recuperação automática sem F5 ou limpar armazenamento; placar em andamento conservou 5–0 e cronômetro, mostrou pontuação não confirmada e gravou 5–0 após reenvio explícito. Nenhuma operação no campeonato de produção durante a validação.

Limite: pontuação ainda não confirmada fica na memória da tela; o operador deve manter a tela aberta até salvar. Esta mudança não constitui operação offline e não comprova a causa do incidente no aparelho original.

Backup dos arquivos anteriores: `tmp/backup-conexao-operacao-20261016` (local, fora da publicação).
