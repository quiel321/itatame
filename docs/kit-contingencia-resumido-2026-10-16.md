# Kit de contingência resumido

O botão Kit Offline PDF agora gera somente a lista de chamada/pesagem da recepção e as árvores das chaves com resultados no papel. Removidos capa, índice, manual, coordenação, chamada separada por tatame, súmulas individuais, conferência central, ocorrências e pódios separados.

As árvores reutilizam o gerador de impressão das chaves. No kit, cada folha contém um quadro com referência da luta, vencedor, placares de pontos/vantagens/punições, método e marcação de lançamento no sistema. Resultados já concluídos aparecem como JÁ SALVO. Categorias maiores continuam divididas com referência à página anterior. A emissão usa o fuso do evento.

A recepção utiliza todas as inscrições fornecidas pelo snapshot, inclusive atletas sem chave, agrupadas somente por categoria. A faixa fica na linha de cada atleta e não abre outro grupo. As árvores do kit também usam a categoria, sem subdivisão adicional por faixa. Contém situação atual, presença, conferência, peso, decisão, rubrica, chamadas e envio ao tatame. Pagamento desconhecido aparece como conferir, nunca como pago.

Nenhuma alteração em banco, atletas, resultados, regras de luta ou check-ins. A mudança é apenas no PDF; o PDF normal das chaves mantém seus campos de pódio. Backup dos dois geradores anteriores em tmp/kit-resumido-20261016/antes.

Ordem das folhas: tanto a recepção e as árvores do kit quanto o PDF normal das chaves seguem tatame (ordenação numérica) e a primeira posição salva da categoria em ordem_tatame. Horários estimados não mudam a fila. Categoria com tatame e sem posição fica após as categorias ordenadas daquele tatame; categorias sem distribuição e inscrições sem chave ficam ao final. O agrupamento por categoria e as árvores existentes são preservados. Backup anterior a essa ordenação em tmp/pdf-sequencia-tatame-20261016/antes.

A lista da recepção mostra a área no cabeçalho de todas as páginas, inclusive continuações, e preenche o tatame de envio quando há uma única área na categoria. Categorias divididas mostram todas as áreas no cabeçalho e mantêm o envio em branco para conferência; sem distribuição, o cabeçalho informa Não definida. Backup anterior em tmp/pdf-area-20261016/antes.

Validação: amostra fictícia de 63 atletas em cinco categorias (3, 4, 8, 16 e 32), com resultado já salvo, caiu de 61 para 16 páginas. Inspeção de todas as páginas renderizadas, testes de preservação dos dados, paginação e campos únicos por luta, incluindo chaves de 1, 2, 3, 6, 13, 32 e 64 atletas.
