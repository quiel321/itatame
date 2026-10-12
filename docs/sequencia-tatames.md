# Sequência de categorias e fila do chamador

## Organizador

1. Em Organizar tatames, selecionar o campeonato e distribuir as categorias.
2. Em cada tatame, usar Ordenar por idade e peso ou ajustar com Subir/Descer.
3. Salvar sequência e tatames. A fila usa a coluna existente `ordem_tatame`.
4. Definir horários por tatame. Usar a hora local do campeonato e o intervalo entre lutas. As estimativas incluem as próximas fases, mesmo quando seus atletas ainda não estão definidos.

A ordenação automática usa os dados estruturados das categorias; chaves antigas usam idade/peso do rótulo quando identificáveis. Dados desconhecidos ficam ao final, com ajuste manual disponível. Mudança de ordem/distribuição limpa somente os horários dos tatames afetados; definir esses horários novamente. Tatame que já recebeu chamada ou iniciou luta real fica protegido contra replanejamento. BYEs resolvidos automaticamente não impedem a preparação.

## Chamador

Selecionar o tatame e abrir Ver sequência das categorias. A lista numerada segue a ordem salva. Tocar em uma categoria filtra as lutas; Ver todas remove o filtro. A lista informa previsão, chamadas, andamento e lutas prontas.

A sequência orienta a operação, sem impedir atender uma categoria posterior liberada. As validações existentes de check-in/pesagem, presença e conflito de atletas permanecem nos controles de chamada. A atualização em tempo real e a consulta a cada dez segundos permanecem. O mesário já consulta a mesma ordem; seu módulo não foi alterado.

## Ativação

Antes de publicar, instalar `supabase/planejamento_tatames_seguro.sql` no SQL Editor do projeto iTatame. O arquivo apenas define uma nova função e suas permissões; não executa planejamento nem modifica chaves existentes. A função exige o organizador autenticado do evento, bloqueia as linhas durante a gravação, confere o planejamento anterior e salva tudo em uma transação. Sem a função instalada, a tela informa o erro e não usa gravações separadas como alternativa.

Não foram criados staff, sessões ou atletas no banco real, nem alterados pagamentos, resultados ou chaves reais na validação. O teste visual usou contas, lutas e notificações fictícias no navegador, interceptando toda requisição externa.

## Validação

- Testes de sequência, fases e demais fluxos de campeonato em memória.
- PostgreSQL isolado: autorização, conflito de edição, rollback de posições repetidas, bloqueio por chamada, preservação de resultados de BYE e outro tatame.
- Navegador em celular de 390 px e desktop de 1366 px: ordenar, salvar, aplicar horário em MT, exibir a mesma sequência no chamador e chamar categoria posterior enquanto a primeira aguarda check-in, sem overflow horizontal.
