# Operação do placar — 16/10/2026

- O painel do mesário apenas abre lutas liberadas pelo chamador. O acesso direto ao placar também valida a liberação; o servidor exige o recibo de chamada para iniciar uma luta agendada. Combates já em andamento continuam operáveis após a implantação.
- A confirmação de uma pausa não abre mais o aviso grande. Pendências continuam salvas no aparelho, com acesso pelo botão de sincronização e recuperação explícita.
- “Trocar lados”, com relógio pausado, move o painel inteiro: nome, equipe, pontos, vantagens, punições e controles. A preferência é local, vinculada à luta e aos participantes; não troca os atletas na chave nem os IDs enviados ao servidor.
- O relógio em 00:00 apenas pausa. Pontos e punições permanecem editáveis. “Encerrar luta” exige método e confirmação nominal do vencedor, incluindo desclassificação. O botão existente de finalização por três cliques permanece disponível.
- O ajuste de relógio antes do início preserva a liberação do chamador. Não é possível iniciar contagem com zero segundos.

## Verificação

- Testes automatizados de autorização, conferência de placar, persistência, resultados manuais, atletas impedidos e tatames: 19 aprovados. Correção atômica de resultados/medalhas: mais 2 aprovados.
- Chrome com requisições externas interceptadas, em 1440×900 e 844×390: iniciar, pausar, retomar, trocar lados, chegar a zero, pontuar, recarregar mantendo posição/pontos, encerrar por desclassificação e bloquear link sem liberação.
- Banco: função substituída apenas dentro de transação revertida, com usuários, evento, atletas e lutas sintéticos. Asserções validaram bloqueio antes da chamada, edição prévia sem perder a liberação, pausa mesmo com reserva conflitante, pontuação após zero, desclassificação, avanço e repetição idempotente. Nenhum dado sintético permaneceu após rollback; a definição original foi conferida intacta antes da implantação.
- A implantação altera somente a definição de `operacao_executar`; não atualiza linhas existentes de eventos, inscrições, atletas ou lutas. Não faz envio de notificações.

Backups locais da função anterior e dos arquivos alterados: `tmp/placar-operacao-20261016/antes/`. Evidências e scripts de QA permanecem em `tmp/placar-operacao-20261016/`, fora do deploy.
