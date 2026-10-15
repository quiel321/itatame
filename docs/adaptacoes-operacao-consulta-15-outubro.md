# Adaptações de operação e consulta — 15/10/2026

Publicação autorizada para real e ensaio. Nenhum operador ou atleta real usado em testes.

- Transferência pelo mesário aceita luta agendada já chamada pelo chamador. Usa função transacional com autorização, bloqueio e conferência da origem; destino deve possuir mesário. Mantém ID, participantes, presenças, chamadas e liberação. A luta vai para posição livre no fim da fila do destino; seu horário anterior é retirado. Luta iniciada, pausada ou encerrada continua bloqueada. Placar aberto na origem não grava pontuação/resultado nem inicia após mudança de área.
- Ranking: pesquisa por nome de campeonato, sem diferenciar acentos/maiúsculas; a seleção continua explícita. Não altera cálculo de pontos.
- Telão: considera inscrições ativas, identifica pessoas por ID e exclui ausências do total pendente. Evento ENCERRADO exibe encerramento em vez de pendências do check-in; acompanha mudança de status em tempo real.
- Campeonato: botão Regulamento renomeado Cronograma, com borda e fundo âmbar. URL e documento configurados permanecem os mesmos.

SQL instalado em ambos os bancos: função transferir_luta_tatame, sem executar transferência. Conferência transacional retornou dados_preservados=true em oito tabelas de cada ambiente. Nenhuma inscrição, pagamento, atleta, check-in, chave ou planejamento existente alterado pela instalação.

Validação: builds e TypeScript dos dois sistemas; PostgreSQL isolado em ambos os schemas com instalação idempotente, preservação de registros, destino inválido, origem antiga, fila de destino ocupada, autorização e bloqueio de combate iniciado/pausado. Telas mobile com todas as APIs e Supabase interceptados: pesquisa/seleção de campeonato, encerramento no modo telão, Cronograma com URL preservada e sem transbordamento, transferência de luta chamada mantendo presença/liberação e nova área visível no chamador. Regressão de quatro combates no build real com dados somente locais.
