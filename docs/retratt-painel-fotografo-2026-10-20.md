# Área de gestão do fotógrafo

O painel agora tem navegação lateral no desktop e menu recolhido no celular. Páginas:

- `/fotografo/dashboard`: visão geral do acervo, trabalhos e vendas recebidas pelo organizador por galeria.
- `/fotografo/galerias`: criação e edição de galerias, envio e gerenciamento de mídias e configurações dos álbuns.
- `/fotografo/vendas`: tabela de pedidos com filtros de situação e acesso ao detalhe existente. O parâmetro `galeria` permite abrir os pedidos a partir do resumo.
- `/fotografo/financeiro`: abas para recebimento direto e recebimento pelo organizador. Mantém o atalho `#vendas-diaria`.
- `/fotografo/perfil`: cadastro, foto, conexão Mercado Pago e gerenciamento de conta.

As mesmas rotas continuam disponíveis com o prefixo `/fotos`. Atalhos antigos do dashboard para álbuns, criação e perfil encaminham para as novas páginas. Operações de criação, edição, upload, exclusão, pagamento, liberação e repasse mantêm seus handlers e APIs.

O financeiro direto apresenta filtros locais por galeria e data de pagamento em America/Cuiaba, tabela por galeria, extrato paginado e exportação CSV do recorte. A base é a resposta autenticada já existente. Valores de tarifa ou líquido desconhecidos continuam em consulta, com aviso quando os totais são parciais. Não se apresenta o líquido como saldo disponível para saque.

Vendas por diária mantêm autoria e valores conferidos pelo servidor. A tabela diferencia preço dos arquivos, descontos, comissão e valor antes da tarifa MP. Repasse continua manual; os números não comprovam recebimento pelo fotógrafo. A tela do organizador preserva sua apresentação e seu escopo de dados.

Validação: TypeScript; lint sem erros; testes de filtros, fronteiras de data e centavos; testes existentes de leitura e escopo dos pedidos. Prévia local com dados fictícios, métodos de escrita bloqueados: navegação, filtro de pagos, detalhe, seleção de galeria, período e menu/filtros mobile. Nenhuma compra, transferência, mensagem ou alteração de cadastro real foi realizada.
