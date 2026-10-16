# Auditoria de continuidade da operação

## Escopo e conclusão

Revisão do código publicado para recepção, chamada e mesário após relato no Chrome. Não foram operadas, alteradas ou removidas inscrições e lutas do evento real ou do evento de teste do usuário. Esta revisão não certifica disponibilidade do servidor nem configurações de backup da hospedagem.

As correções de reconexão já publicadas melhoram a recuperação de falhas transitórias, mas não constituem garantia de perda zero. O principal intervalo de risco é entre o clique do operador e a confirmação da gravação, incluindo a hipótese de o servidor concluir a ação e a resposta se perder.

## Constatações

| Prioridade | Etapa | Evidência | Consequência possível |
| --- | --- | --- | --- |
| Alta | Placar | `app/staff/placar/[id]/page.tsx`: pontos e fila de gravação em estado/ref de React, sem rascunho durável | Recarregar, encerrar a aba ou reiniciar o navegador pode perder pontos ainda não confirmados |
| Alta | Resultado | `processarFimDeLuta` grava confronto, chama `propagarResultadoChave`, depois chama `ajustar_medalha_staff` para cada medalha | Queda entre requisições pode deixar resultado, chave e contadores parcialmente atualizados |
| Alta | Resultado | `ajustar_medalha_staff` incrementa contador sem identificar unicamente a operação/luta; guarda de conclusão no navegador | Não há deduplicação de toda a finalização. Repetição após resposta perdida exige consulta/conciliação; repetir apenas incrementos pode duplicar medalhas |
| Média | Pesagem | `processarCheckin` chama RPC e retorna à lista em caso de erro; não há rascunho persistente da ação | Peso digitado sem confirmação não tem recuperação durável. É preciso conferir o estado no servidor antes de repetir |
| Média | Pesagem e chamada | Depois da gravação existem `await fetch('/api/notificar', ...)` sem limite de espera próprio | A tela pode ficar ocupada esperando notificação mesmo que a ação principal já esteja salva |
| Verificação pendente | Infraestrutura | Configuração vigente de backup, retenção e restauração do banco não auditada nesta revisão | Não confundir o backup privado do evento fictício com cobertura contínua do campeonato real |

Proteções encontradas: pesagem via RPC com estado anterior e bloqueio de categoria; despacho já fechado tratado no SQL como operação repetida; chamada condicionada ao estado da luta/tatame/presença; pontos serializados por lado com erro visível e reenvio explícito; limite de espera REST/Auth; recuperação de leitura por polling/foco/conexão. Arquivos SQL locais descrevem as proteções, mas não substituem uma inspeção atual das funções instaladas no banco.

## Critérios para liberação com instabilidade

1. Rascunho durável por evento, inscrição/luta, posto e versão, guardando apenas dados necessários. Não marcar como salvo antes de confirmação. Recuperar o rascunho após fechar/reabrir a aba; não reenviar alterações antigas sobre um estado mais novo.
2. Ações críticas com identificador único, confirmação consultável e deduplicação no servidor. Timeout representa estado desconhecido até conferência, não prova de que a gravação falhou.
3. Finalização transacional no banco: resultado, avanços e medalhas juntos, com controle de versão e autorização do posto. Resultado repetido não pode contar duas vezes; conflito entre operadores deve ser rejeitado e explicado.
4. Notificações desacopladas da confirmação operacional, com limite de espera e sem bloquear pesagem ou despacho já salvos.
5. Backup do banco verificado, retenção definida e restauração ensaiada. Redundância de internet e procedimento de contingência coordenado pelo organizador.

## Ensaio de aceitação

Executar em evento controlado, com backup e autorização operacional específica, sem modificar o campeonato Spartan nem reiniciar o evento que o usuário está operando.

| Falha injetada | Verificação obrigatória |
| --- | --- |
| Sem rede antes do envio de peso/presença/pontos | Rascunho recuperável; nada exibido como confirmado |
| Gravação aceita e resposta perdida | Consulta reconhece a mesma operação; não duplica chamada, vitória, avanço ou medalha |
| Queda durante encerramento | Todos os efeitos ficam gravados juntos ou nenhum é aplicado |
| Rede volta após outras alterações | Não sobrescreve dados mais recentes; conflito explícito |
| Dois operadores tentam agir no mesmo confronto/atleta | Uma versão válida; segunda ação rejeitada ou reconhecida como repetida |
| Chrome em segundo plano, tela bloqueada e sessão perto de expirar | Retoma leitura e autenticação sem limpar dados locais; cronômetro e pendências preservados |
| Fechar/reabrir navegador com pontos pendentes | Recupera rascunho e exige conciliação com o servidor antes de continuar |
| Serviço de notificações sem resposta | Pesagem e despacho salvos são confirmados sem esperar indefinidamente |

Critério de aprovação: nenhum registro confirmado desaparece; nenhuma ação duplicada; nenhum rascunho perdido; nenhuma finalização parcial; pendências e conflitos sempre visíveis. Os testes anteriores de reconexão não cobrem integralmente estes critérios.
