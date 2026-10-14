# Atualização de código real — 14/10/2026

Autorização do usuário: atualizar apenas códigos, sem executar SQL nem mexer em dados reais durante o encerramento de inscrições e pagamentos.

Base real `cf3af876364f5eef77c122eba9cb83bc254d342e`. Commit local `21952da`, remoto `ba479975e36dd95a9dac9d86c3107679a64ac0ff`, repositório `quiel321/itatame`, branch `main`. Publicação direta por conector GitHub com conferência do HEAD e proteção contra atualização concorrente; nenhum push forçado. Arquivos temporários, PDFs, credenciais, SQL e dados do ensaio excluídos.

Vercel confirmou status **success** para esse commit: https://vercel.com/ezequiel-castro-s-projects/itatame/8TZuc61UYg46q5oYa45oT1BvwLYX . Nenhum teste operacional foi executado no campeonato real após o deploy.

## Código incluído

- Idade competitiva do jiu-jitsu: ano do evento menos ano de nascimento. Formulário explica a regra. Outras modalidades explícitas continuam com idade na data do evento. Idade civil de conta/responsável permanece intacta. Nenhuma inscrição existente foi modificada, inclusive a de Débora Celso.
- Placar carrega o tempo da categoria vinculada, preserva configuração manual e usa a referência regulamentar para registros legados. Pausa desarma expiração antes de aguardar a rede e impede cliques concorrentes. Estatísticas e permissões reais de medalhas foram preservadas: nenhuma função exclusiva do ensaio foi copiada.
- Check-in exige confirmação de Kimono/Faixa para aprovar, sem transformar a aprovação em desclassificação. Reprovar continua sendo ação explícita. Limite exibido vem da categoria vinculada, incluindo absoluto sem limite.
- Transferência revalida estado e origem, mantém presença e chamada da baia, rejeita luta já liberada/iniciada, avisa a operação por broadcast. Início do combate revalida evento/tatame e protege contra fila desatualizada.
- Painel distingue resultados de combates, avanços por BYE e vagas vazias; nomes na árvore menores e completos com quebra de linha.
- Avanço automático protege leitura desatualizada e propagação ainda pendente, sem tratar TBD herdado como vaga vazia. Algoritmo de sorteio/geração não foi alterado.
- TypeScript exclui diretórios locais temporários e artefatos da verificação, impedindo que o checkout independente do ensaio seja compilado como parte da produção.

## Preservação e limitações

Correções anteriores de professor/responsável, CPF, identidade do atleta, pacote, cupom, pagamentos e notificações foram mantidas. Schema de produção continua `public`. Nenhum SQL, migração, endpoint de escrita, geração de chaves, ação de check-in ou alteração de cadastro/pagamento/PIN/data foi executado pelo agente em produção. Não visitar páginas que disparam geração automática para verificar deploy; usar status da Vercel.

Integração completa Recepção/Chamador com ausência e fechamento transacional, revisão de posições e publicação de rascunhos **não foram incluídas**. Dependem de tabelas/funções novas; publicar sua interface sem o SQL quebraria o fluxo. Permanecem validadas somente no ensaio. Não executar o SQL do ensaio em produção: ele é limitado ao schema/identidade de treinamento.

## Validação

TypeScript final sem erros; compilação local de produção com 135 rotas concluída; 55 regressões de idade, checagem, 100 atletas, árvores, ranking, cancelamento/pagamento e identidade, mais teste de aprovação sem kimono e dois testes de conta/responsável passaram. Teste extra executando o código real do cronômetro com rede simulada lenta confirmou pausa/retomada, proteção de clique repetido e expiração única. Testes não usaram banco real.

