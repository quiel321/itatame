# Vendas e pedidos — Retratt

## Acesso

- Organizador: painel → Receitas de fotos → Vendas e pedidos (`/fotos/admin/vendas`).
- Fotógrafo: Financeiro → Vendas e pedidos (`/fotos/fotografo/vendas`).

As telas usam um endpoint novo, autenticado e somente de leitura: `GET /api/fotos/vendas-pedidos`.
O organizador consulta as galerias vinculadas ao próprio usuário. O fotógrafo consulta apenas pedidos que contêm arquivos de sua autoria; valores, arquivos e downloads são reduzidos à sua participação, e dados dos compradores não são retornados.

## Situações

Pix aguardando pagamento exige cobrança registrada com o detalhe `pending_waiting_transfer`. Checkout iniciado não tem identificador de cobrança; não é apresentado como Pix gerado. Pagos, outras cobranças, cancelados e reembolsados possuem filtros próprios.

Compras relacionadas são comparadas por galeria, identidade e arquivos em comum. Conta ou e-mail coincidente permite identificar itens já comprados. Nome coincidente com cadastro diferente gera apenas um alerta de possibilidade; não modifica nem cancela pedidos. O rascunho de lembrete fica bloqueado nesses casos. Nos casos de identidade confirmada, o rascunho menciona somente a quantidade ainda não comprada e não contém o valor ou o link do Pix anterior.

## Histórico e financeiro

O painel exibe preços e valores já registrados, autoria e rateio de diária congelados, liberação atual dos itens, envio de e-mail registrado e solicitações de download. Não inventa horários de geração de cobrança nem afirma entrega na caixa de entrada ou salvamento no aparelho.

O organizador pode consultar método, situação e tarifa diretamente no Mercado Pago ao abrir os detalhes. A consulta verifica identificador, referência, valor e conta recebedora. Não executa sincronização, renovação OAuth ou gravação no banco. Se houver falha, os dados locais continuam disponíveis.

Os valores antes da tarifa MP não representam líquido final nem comprovam repasse aos fotógrafos. Os repasses do modelo diária continuam manuais.

## Limites e isolamento

- São consultados até 500 pedidos recentes da galeria, com ordem estável. Se houver mais, a tela informa que os totais são parciais e bloqueia rascunhos de lembrete.
- Os registros de acesso ao download são buscados apenas ao abrir um pedido; o total vem da contagem exata, e a quantidade de arquivos acessados é sinalizada como parcial se houver mais de 500 registros.
- A lista atualiza ao abrir, escolher galeria ou clicar em Atualizar. Não há polling em segundo plano nem chamadas ao MP para cada linha.
- Pré-visualizações protegidas possuem links temporários. Nenhum link de original ou credencial é retornado.
- Preparar lembrete gera texto editável para revisão e cópia. Não há envio de e-mail/push nem automação.
- Checkout, webhook, confirmação de pagamento, liberação, envio de e-mail e carrinho existentes não foram modificados.

## Verificação

Testes automatizados cobrem autorização e isolamento, classificação, rateio, compras relacionadas, rascunhos, falha do MP, limite de histórico e ausência de operações de escrita. Os testes existentes de checkout de diária, relatório do fotógrafo, retorno Pix e webhook continuam passando.

Consultas de leitura na galeria real validaram os relacionamentos PostgREST e a soma das participações dos dois autores. Testes visuais locais cobriram 320, 390, 768 e 1280 px, busca, paginação, diálogo, proteção de lembretes e privacidade do fotógrafo. Nenhuma cobrança, mensagem ou alteração de dados reais foi realizada.
