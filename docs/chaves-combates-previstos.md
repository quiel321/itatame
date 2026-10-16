# Exibição dos combates previstos

As páginas públicas `/evento/[id]/chaves` e `/evento/[id]/publico` usam um modelo somente de leitura das ligações `proxima_luta`.

- Um nó com duas origens possíveis representa um combate, mesmo que os vencedores ainda sejam desconhecidos.
- Um nó com uma origem representa avanço sem combate e é contraído até a próxima luta real.
- Um nó sem origens não é mostrado como luta.
- As vagas da final indicam o confronto de origem, inclusive quando pulam uma fase vazia.
- Resultados preenchidos não mudam essa contagem estrutural.
- A apresentação própria das chaves de três e de estruturas antigas sem ligações suficientes é mantida.

Exemplo: cinco atletas distribuídos em dois à esquerda e três à direita geram quatro combates: duas quartas, uma semifinal à direita e a final. A esquerda segue das quartas diretamente à final. Seis atletas na eliminatória padrão geram cinco combates.

Nenhuma linha do banco é modificada. Não há geração, reordenação, troca de atletas ou avanço automático causado por esse modelo. Check-in e operação continuam sendo responsáveis pela liberação efetiva. Não é necessária migração SQL.
