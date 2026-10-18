# Mídias do fotógrafo, filtro de vendas e atalho

O gerenciador consultava os itens de pedido colocando todos os identificadores de mídia numa única URL. Para centenas de arquivos isso ultrapassa limites de transporte e pode voltar Bad Request, zerando a tela mesmo com os arquivos publicados. Agora as mídias são lidas em páginas de 500, ordenadas por ID com cursor. Os itens de pedido são consultados em grupos de 100 mídias, também com paginação por ID. As contagens de vendas, reservas e a proteção de arquivos vinculados são mantidas. A ordenação visual continua pela criação mais recente.

Um erro de carga passa a mostrar Tentar carregar novamente, em vez de afirmar que a galeria está vazia. Não foram alteradas as permissões de leitura, os arquivos, vendas, preços ou ações de edição e exclusão.

O histórico Vendas e pedidos incluía vínculos de qualquer status na lista de galerias. Agora só entram credenciamentos ativos, além das galerias próprias. Uma galeria fora dessa lista também é recusada quando informada diretamente na URL. O vínculo suspenso encontrado para a conta indicada foi preservado; nenhum credenciamento foi criado ou reativado.

Ver minhas vendas passa a ser botão destacado no cabeçalho do resumo, disponível mesmo sem vendas pagas. No resumo leva ao financeiro por galeria; no painel detalhado leva a Vendas e pedidos.

Validação: simulação de 1.101 mídias e mais de 1.000 vendas em um lote, limite de tamanho da URL, paginação de mídias e pedidos, autoria, contagens, recusa sem credenciamento ativo, filtro com vínculo suspenso e recusa da seleção direta de galeria suspensa. TypeScript e ESLint direcionados. Consultas de diagnóstico somente de leitura; sem alteração de registros de produção.
