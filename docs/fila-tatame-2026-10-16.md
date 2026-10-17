# Fila do tatame durante outro combate

O chamador pode liberar várias lutas para o mesmo tatame enquanto existe um combate em andamento, inclusive escolhendo uma luta posterior à ordem sugerida. A liberação mantém a luta agendada: quem inicia o combate é o mesário.

A validação de ocupação em `operacao_executar` agora se aplica somente a `iniciar` e ao relógio com `rodando=true`. Outro confronto com `status_luta=em_andamento` impede o início, inclusive quando pausado. Uma luta agendada liberada pelo chamador não ocupa a área.

Permanecem os bloqueios de atleta reservado em outro confronto, check-in, presença dos dois atletas, categoria despachada, posto/tatame correto, participantes e versões divergentes, além dos recibos idempotentes. Nenhum componente visual foi alterado.

## Implantação e conferência

- Migração aplicada no Supabase: `chamador_fila_tatame_ocupado_20261016`.
- Backup da definição anterior guardado em `tmp/fila-tatame-20261016/antes/operacao-executar.sql`, SHA256 `8AFB416B181A2781FC325D320D07BB2077027DD5DF695C69998BD984BD4E1793`.
- A aplicação comparou a definição existente ao backup antes de substituí-la; não executou alteração de registros de campeonatos, atletas, inscrições ou resultados.
- Cenários transacionais com dados fictícios e rollback: liberar #3 antes de #2 enquanto #1 roda; duas lutas agendadas na fila; repetição do mesmo pedido sem duplicação; bloqueio do mesmo atleta; presença obrigatória; iniciar/rodar outro combate bloqueado com #1 rodando e pausado; após encerrar #1, iniciar #3 com #2 ainda na fila.
- Reexecutada também a regressão de liberação obrigatória pelo chamador, pausa, edição do relógio, pontos após tempo esgotado, desclassificação, avanço e idempotência. Ambas as verificações passaram antes e/ou após a implantação, sem persistir os dados de QA.
- Definição publicada conferida; `anon` permanece sem execução e `authenticated` mantém acesso validado dentro da função.

Tentativas locais antes recusadas por ocupação podem ser reenviadas por “Conferir ação pendente”. A conferência continua validando participantes, estado e autorização; não se deve apagar o armazenamento do aparelho.
