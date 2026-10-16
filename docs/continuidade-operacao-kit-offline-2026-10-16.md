# Continuidade da operação e kit offline — 16/10/2026

## Implantação

A instalação adiciona recibos e funções transacionais, sem recalcular resultados anteriores. Backup privado completo antes da instalação: 36 tabelas/views, 1.642 registros, acompanhado de hash e cópia das funções/triggers existentes. Arquivos privados ficam em `tmp/continuidade-operacao-20261016` e não são publicados.

Instalação inicial comparou o conteúdo das 35 tabelas base existentes antes/depois. Validação posterior comparou 36 tabelas base incluindo a nova tabela de recibos: todos os registros preservados. Teste na infraestrutura real criou somente registros fictícios não confirmados, executou operações e provocou reversão integral da subtransação; nada desses testes permaneceu visível ou salvo. Não houve DELETE, reset do evento do usuário ou modificação do Spartan.

## Comportamento

Pesagem, chamada, presença, cronômetro, pontuação, resultado e correção guardam uma intenção identificada no aparelho antes do envio. A repetição usa o mesmo UUID; o servidor devolve o recibo anterior, sem repetir efeitos. Pendências sobrevivem ao reload. Conferência é explícita: a reconexão não reproduz automaticamente ações de competição. Conflitos rejeitam a tentativa sem sobrepor o trabalho de outro operador. Arquivamento de uma tentativa recusada exige confirmação da conferência pelo organizador e grava uma cópia integral local antes de liberar nova ação.

Resultado, avanço, perdedor da baia e medalhas são uma transação. Falha em qualquer parte reverte o conjunto. Pontuação tem comparação com a base lida e grava somente os campos do placar, preservando os dados do chamador. Reservas concorrentes são serializadas por evento.

A súmula do organizador aceita pontos, vantagens, punições e método; combate iniciado online exige confirmação expressa de encerramento no papel. Recibo evita duplicação após resposta perdida e o lançamento fica auditado. Não é permitido lançar rodada futura antes das alimentadoras.

## Kit impresso

Exportação usa uma fotografia consistente do evento, com todas as categorias de peso e absoluto e inscrições ativas. Inclui roteiro de contingência, índice por função, coordenação, pesagem/documento/kimono/ausências, chamada, duas súmulas por página, controle dos avanços, reconciliação, ocorrências e pódios. Cada luta tem código desta edição e UUID permanente. Azul corresponde ao atleta 1 e vermelho ao atleta 2. Não inclui CPF, nascimento, contatos ou PINs.

A amostra privada do Spartan tem 90 páginas. Renderização e revisão de todas as páginas realizadas; emissão de conferência, anterior à definição final dos horários. Reemitir depois de salvar a programação e sempre que mudar inscrições, chaves ou distribuição. Uma única edição deve ser usada por toda a equipe.

## Validação

- 33 testes direcionados passaram: persistência, resposta perdida, armazenamento indisponível, conflito, correção, hierarquia de súmulas, chave de três e recuperação de autenticação/rede.
- PostgreSQL local: deduplicação, bloqueio de conflito, avanço atômico, destino já operado, triangular/baia, rollback de falha de medalha, correção de ouro/prata, súmula de confronto iniciado e autorização do kit.
- Banco real: recibo repetido, conflito de pontuação rejeitado, encerramento, recibos únicos e snapshot do kit; reversão integral dos testes e comparação de todos os registros.

## Limites operacionais

Atualizar os aparelhos antes de começar a operação, para carregar esta versão. Não atualizar nem trocar de posto enquanto houver pendência sem conferência. Não limpar cache/dados do navegador com pendências: o rascunho está nesse aparelho. O kit impresso continua necessário para queda prolongada, falha do aparelho ou indisponibilidade do serviço. Não se promete funcionamento integral offline nem impossibilidade absoluta de falha. O erro específico do Chrome relatado pelo usuário ainda não foi reproduzido no aparelho original.

## Categoria apontada pelo usuário

Consulta somente leitura em produção: Adulto médio TESTE possui três atletas distintos, TEMP 05, 06 e 07. TEMP 05 participa da luta inicial e depois da baia. Existem três confrontos, IDs visuais 1, 2 e 999; final TEMP 06 × TEMP 07. O rótulo Chave de 3 é correto nesse caso. Nenhuma luta ou inscrição foi alterada por essa conferência.

Validação visual local: perda de resposta após gravar ponto; reload manteve placar e pendência; conferência terminou em 2 pontos, sem duplicação. Corrigido carregamento do placar para renovar vínculo do posto e oferecer nova tentativa em falha de consulta, sem alertas falsos de luta inexistente nem redirecionamento automático. Build completo e TypeScript aprovados.
