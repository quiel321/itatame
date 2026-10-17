# Indicador de vendas por diária para o fotógrafo

O dashboard do fotógrafo mostra quantidade de arquivos próprios vendidos e pagos no modelo diária, valor após descontos e base após comissão Retratt, antes da tarifa do Mercado Pago. O financeiro apresenta o detalhamento por galeria e planilha CSV. A interface esclarece que o organizador recebeu o pagamento e que os valores não indicam repasse já realizado nem líquido final recebido pelo fotógrafo.

As vendas diretas por royalty continuam no financeiro original. O contador de vendas diretas do dashboard filtra o modelo royalty para não confundir vendas recebidas pelo organizador com recebimentos próprios.

## Acesso e autoria

O novo endpoint `/api/fotos/fotografo/vendas-diaria` exige autenticação e resolve o ID do fotógrafo ativo pelo usuário autenticado. Não aceita um ID de fotógrafo do cliente como autorização.

Lê dois conjuntos disjuntos de pedidos pagos de diária: novos pedidos com registro de autoria contendo o próprio fotógrafo, e pedidos antigos com registro nulo e `fotografo_id` desse autor. Usa o mesmo registro financeiro e as mesmas funções de rateio/conferência já usados no relatório do organizador. A resposta filtra novamente os registros para devolver somente a parcela do fotógrafo autenticado, sem os valores, nomes ou dados dos demais autores, e não inclui dados do comprador ou identificadores de pagamento.

Consultas são paginadas em lotes de 250 com ordenação estável. Cancelados, reembolsados e pendentes são excluídos pelo filtro de status pago. Valores históricos não são recalculados por regras atuais e nenhuma linha é gravada pelo endpoint.

## Verificação

- 13 testes passaram, incluindo relatório dos dois perfis, bloqueio sem login/perfil ativo, tentativa de pedir outro autor por URL, preservação de parcelas em pedido misto, legado e paginação com 251 pedidos.
- TypeScript sem erros.
- Filtro JSON de autoria e relacionamentos validados com SELECT no banco real usando ID fictício, sem alterações.
- Chrome desktop/mobile: indicador no dashboard, link para financeiro, planilha só com o próprio autor, nenhum overflow e nenhuma mudança no relatório do organizador. Dados e endpoints simulados no navegador.
- Sem migrações, cobranças, notificações, alterações em contas, taxas ou vendas reais.

Backups e provas privados: `tmp/retratt-diaria-fotografo-20261017/`.
