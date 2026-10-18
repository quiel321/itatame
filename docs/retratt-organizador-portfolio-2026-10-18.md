# Painel compacto e portfólio do organizador

O painel passa a usar resumos menores, saudação compacta com a imagem pública do perfil e acesso direto a Vendas e pedidos e Meu site público.
Descontos progressivos, credenciamento/recebimento dos fotógrafos e detalhes financeiros ficam em seções nativas recolhíveis. Os formulários continuam montados ao recolher, preservando edições locais. As funções de criação, edição, exclusão, credenciamento e configuração financeira foram preservadas.

O controle rápido de Em breve aparece enquanto o aviso está ativo. Ao confirmar a desativação, sai da tela inicial. O ajuste continua disponível em Editar e na criação da galeria. Nenhum aviso de galeria existente é desativado automaticamente pela publicação desta melhoria.

A página pública mantém o endereço `/organizador/<slug>` e agora apresenta capa, logo, nome e navegação do próprio organizador. Busca por evento/local e filtros por categoria, cidade e ano funcionam sobre as galerias públicas. O cabeçalho oferece acesso às compras e carrinho, com contagem dos itens; o rodapé apresenta a tecnologia Retratt. O cabeçalho e rodapé padrão das outras páginas continuam sendo o comportamento padrão de FotosShell.

O portfólio é carregado no servidor, com seleção explícita de campos públicos e contagem agregada das mídias publicadas. Galerias em rascunho, arquivadas ou restritas por link não são expostas. Não são retornados contatos privados, tokens de acesso, pagamentos ou caminhos de arquivos originais. Sem fotos de capa, usa um fundo neutro; imagens aleatórias de terceiros e o selo sem comprovação de “verificado” foram removidos.

Foram consultadas as páginas públicas da ASV na Banlek e da ATS na Fotop apenas como referências de identidade e navegação. Nenhum perfil, material ou contato desses profissionais foi copiado ou cadastrado na Retratt.

Verificações: TypeScript, ESLint dos arquivos novos, testes de filtros e seleção pública, testes existentes de Em breve, conexão MP e acompanhamento de pedidos. A consulta real de leitura do portfólio Spartan confirmou a contagem de mídias, e uma comparação por AST confirmou 17 funções administrativas preservadas (o carregamento recebeu apenas o estado visual do avatar). A simulação local foi conferida em desktop e em larguras móveis de 320/390 px, incluindo abertura dos descontos e credenciamento, pesquisa e estados vazios.

Não houve migração, gravação de dados reais, envio de mensagens ou modificação do checkout, pagamentos, webhooks ou liberação de arquivos.
