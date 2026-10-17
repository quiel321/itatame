# Legibilidade do telão

Somente apresentação: fotos, nomes completos, caixas e números da pontuação passam a acompanhar o tamanho de cada cartão. Os nomes dos atletas em combate têm quebra de linha, sem limite de linhas ou abreviação; nomes extensos recebem ajuste visual de fonte. Pontuações com três dígitos também cabem na caixa.

A grade mede a área disponível com `ResizeObserver` e distribui as lutas em colunas e linhas conforme a quantidade e a proporção da tela. As dimensões internas usam unidades de consulta do cartão, com composição compacta para grades mais densas. A ordem, os participantes e os dados exibidos são os mesmos.

Validação no Chrome com todas as consultas externas interceptadas: 13 cenários, entre 1 e 12 lutas, em 1280×720, 1366×768, 1920×1080 e 1080×1920. Foram conferidos nomes completos, fotos, pontuação e limites dos cartões. Em 1366×768 com duas áreas, a foto tem aproximadamente 125 px, o nome 36 px e o número dos pontos 119 px. A atualização simulada de pontos chegou sem F5; nenhuma escrita foi feita.

Comparação da árvore sintática confirmou que as funções operacionais e o modo público padrão permaneceram intactos. Os três testes de atualização ao vivo passaram. Backup anterior, capturas e relatório local ficam em `tmp/telao-legibilidade-20261016/` e não são publicados.
