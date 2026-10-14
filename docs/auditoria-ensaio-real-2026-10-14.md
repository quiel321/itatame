# Conferência de equivalência entre ensaio e produção

Comparados os 26 arquivos do aplicativo alterados nos commits do ensaio desde a preparação inicial até `96f7ff5`, além dos dois SQLs operacionais. Comparação feita após normalizar somente schema, import do SDK, nome do helper operacional e posição do banner fictício.

## Melhorias transferidas

Recepção/Pesagem e Chamada/Tatames; PIN completo e PINs separados; aprovação com kimono; limite regulamentar da categoria; interface mobile compacta; chamadas/ausência/fechamento por categoria; despacho; W.O./triangular; presença na baia e transferências; cronômetro da categoria e pausa protegida; navegação mobile do placar; contagem de combates/BYEs; revisão das posições iniciais/publicação; bloqueio público de rascunhos; nomes completos na árvore; ranking que exclui vagas vazias; idade competitiva anual do jiu-jitsu.

## Diferença funcional identificada e corrigida nesta auditoria

O ensaio usava RPC para medalhas. Produção havia preservado UPDATE direto, mas as policies reais de SELECT de atletas limitam o acesso ao perfil/responsável. Teste isolado reproduziu UPDATE com zero linhas sob RLS. Transferida a função atômica como `public.ajustar_medalha_staff`: somente mesário com sessão válida do evento, atleta com inscrição confirmada e ativa, quatro contadores permitidos, incremento ±1. A instalação cria somente a função, sem executar ajustes existentes. O placar agora informa falha em vez de ignorá-la.

## Diferenças intencionais preservadas

- SDK/schema, storage, banner, domínio e credenciais do treinamento continuam exclusivos do ensaio.
- Real mantém correções posteriores de inscrição de professores/responsáveis, identidade por atleta/CPF e exceção auditada de sexo autorizada pelo organizador. Não copiar versões antigas desses módulos do ensaio.
- Helper antigo `checkin-inscricoes.ts` não tem chamadas no aplicativo: check-in operacional usa RPC por ID exato da inscrição.
- Produção acrescenta guarda de encerramento de inscrições na pesagem e restringe UPDATE de lutas aos operadores do evento. Recepção/publicação equivalentes após remover restrições a nomes fictícios.
- Idade anual está no código local do ensaio, mas o último deploy anterior do treinamento não incluía esse commit. O real já contém a regra; alinhar o deploy do ensaio antes de testar inscrições novamente.

## Evidências

Testes locais da função sob RLS: caminho antigo bloqueado; novo caminho grava/corrige; instalação idempotente preserva registros; coluna inválida, incremento inválido, ausência de vínculo, posto errado, estorno e pagamento pendente rejeitados. Teste do código real das duas funções do placar exige RPC e erro explícito. Não foi feito ensaio operacional no banco real.

Teste anterior de quatro lutas, recepção/revisão mobile, 100 atletas, geração, cancelamento/pagamento, idade, avanço e ranking executado com dados fictícios e rede interceptada. Isso reduz riscos; não constitui promessa de ausência de falhas de rede, dispositivo ou serviço no campeonato.

