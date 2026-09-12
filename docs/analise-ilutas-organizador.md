# Análise do organizador iLutas e evolução do Itatame

Data: 12/09/2026.

## Escopo e limites

Consulta autenticada às telas do iLutas autorizadas pelo usuário: painel, configuração (inscrições, checagem e publicação das chaves), secretaria, equipes, chaves, pesagem, tarefas e resultados. Foram abertos formulários e menus, sem salvar cadastros ou executar unificações, sorteios e alterações. A comparação do Itatame foi feita pelo código local; não equivale a um teste completo em produção nem à auditoria do banco.

O formulário de criação de equipe mostrou o campo nome. A listagem também oferece logo, professores e unificação das equipes nas inscrições do evento. Em categorias, foi confirmado o comando “Criar Nova Categoria”, mas o conteúdo do formulário não ficou acessível; seus campos e regras não foram validados. Menus de planejamento, premiação e comunicação não foram considerados funcionalidades completas apenas por existirem no painel.

## Conclusão

A principal necessidade do Itatame é estruturar equipes e categorias e conectar a preparação à operação que já existe. Preservar a identidade visual atual, com navegação consistente por campeonato e recursos agrupados pela etapa em que são utilizados.

## Comparação

| Tema | Observado no iLutas | Encontrado no Itatame | Evolução proposta |
|---|---|---|---|
| Equipes | Cadastro nominal, busca no evento ou portal, logo, professores e unificação com escolha da equipe que permanece | Equipe e professor em campos de atletas; edição textual de equipe na inscrição; separação no sorteio e ranking por nome | Cadastro com identificador estável, professores e unidades; seleção com busca; prevenção de duplicatas e unificação com prévia |
| Categorias | Tabela selecionável por evento, recorte de idade e sexo, categorias compostas, contagem de inscritos e comando de nova categoria | Inscrição oferece cinco opções fixas de peso; geração de peso agrupa categoria textual + faixa | Tabelas versionadas por evento, com modalidade, sexo, idade, graduação, peso e duração; geração e validação usando a mesma categoria |
| Inscrições e absoluto | Limites de participantes e por equipe, múltiplas categorias, idade por ano ou início do evento, regras detalhadas de absoluto | Lotes, cortesias, pagamento e peso + absoluto; adicional do absoluto fixo no código | Regras e preço do absoluto por evento; capacidade; elegibilidade centralizada |
| Checagem | Preliminar/oficial, prazo para correções, opção de ajuste para atleta sozinho | Consulta por atleta, categoria e equipe, limitada ao período definido e inscrições pagas | Fila de solicitações, análise de categorias com um atleta, histórico e fechamento oficial |
| Chaves | Contagem por categoria, filtros de chaves não geradas, localizar atletas sem chave, relatórios, impressão | Geração, separação de equipes, BYE, tratamento de três atletas, exportação e avanço | Prévia do sorteio, validação de cobertura de inscritos, publicação separada de geração e proteção de resultados |
| Pesagem | Busca por número/nome, categoria e filtros, opção de check-in | QR, verificação de pagamento, aprovação e desclassificação por peso/kimono | Peso aferido, limite aplicado, responsável e histórico; revisão explícita de ocorrências |
| Cronograma e arena | Configuração de cronograma no evento e acesso a placar; operação detalhada não auditada | Distribuição por tatame, geração de horários, fila, chamador, placar e acompanhamento público | Conflitos entre inscrições do mesmo atleta, descanso configurável, pausas e alertas de atraso |
| Resultados e premiação | Consulta de resultados, filtro sem resultado, atalhos de campeões e estimativa de medalhas no menu de chaves | Apuração de medalhas, ranking e pontuação configurável por equipe | Fila de pódio, conferência, registro de entrega e encerramento do evento |
| Tarefas | Lista de tarefas e comando de nova tarefa | Não identifiquei módulo equivalente no conjunto de rotas revisado | Pendências ligadas ao campeonato, com responsável e prazo, no resumo do evento |

## Prioridade imediata: categorias e consistência

1. Em `app/inscricao/page.tsx`, a categoria automática depende só do peso e o seletor oferece cinco faixas de peso fixas. Idade é digitada separadamente. A tabela do evento precisa determinar as opções válidas.
2. Em `app/admin/chaves/page.tsx`, a chave de agrupamento de peso é `${inscricao.categoria}__${faixaAtleta}`. Sexo e divisão etária não participam. Com as opções genéricas da inscrição, atletas de divisões diferentes podem entrar no mesmo grupo. Corrigir antes de confiar no sorteio para um evento com múltiplas divisões.
3. Checagem e geração consultam equipe/faixa atuais do perfil, enquanto a edição administrativa modifica dados da inscrição. Isso pode fazer uma correção aparecer em uma tela e não ser usada em outra. Usar os dados aprovados daquela inscrição como referência do evento.
4. A geração remove chaves anteriores do tipo escolhido antes de concluir o novo conjunto. Separar simulação, validação e substituição atômica; impedir substituição comum quando houver luta iniciada ou resultado registrado.
5. O tempo de luta é inferido de palavras no nome da categoria em `app/lib/cronograma.ts`. Categorias estruturadas devem fornecer o tempo explicitamente, conforme o regulamento selecionado.

Esses são achados de leitura do código, não relatos de incidentes observados em campeonatos.

## Organização proposta

Manter um campeonato selecionado no cabeçalho e preservar esse contexto ao navegar. O painel geral do organizador continua útil para escolher eventos e ver números consolidados. Dentro de um evento:

| Área | Conteúdo |
|---|---|
| Resumo | Etapa atual, inscrições, pendências e próxima ação recomendada |
| Preparação | Dados do evento, regulamento, tabelas de categorias, prazos e regras de inscrição |
| Participantes | Inscrições, equipes e professores, correções e checagem |
| Competição | Chaves, cronograma, tatames e pesagem; atalhos para chamador e placar |
| Financeiro | Pagamentos, isenções, cortesias e conciliação existentes |
| Resultados | Pódios, pontuação por equipe, premiação e encerramento |

“Gestão de Equipe” atualmente abre credenciais/PINs dos operadores. Renomear para “Equipe de operação” e manter “Equipes e professores” para academias. Configurações avançadas ficam recolhidas e aparecem conforme modalidade e formato do evento.

## Ordem de implementação

### 1. Base necessária para competir

- Cadastro de equipes e professores com identificadores, busca e tratamento de duplicidades.
- Categorias estruturadas e tabela versionada escolhida para cada evento.
- Elegibilidade única para inscrição, checagem, sorteio, pesagem e cronograma.
- Correção do agrupamento por sexo e idade e uso dos dados aprovados da inscrição.
- Prévia e proteção contra perda de chaves/resultados.

Critério de aceite: atletas de divisões distintas não se misturam; toda inscrição apta aparece exatamente nas disputas autorizadas; correção aprovada é consistente em todas as telas; regeneração não apaga competição em curso.

### 2. Preparação sem retrabalho

- Checagem preliminar e oficial com fila de correções.
- Lista de atletas sozinhos, sem chave ou com categoria inválida.
- Regras de absoluto e capacidade por evento.
- Fechamento da checagem e publicação explícita das chaves/cronograma.

Critério de aceite: antes de publicar, o organizador vê todas as pendências e consegue identificar o motivo de cada inscrição não elegível. Mudanças relevantes possuem autor, data e justificativa.

### 3. Operação e encerramento

- Registro detalhado de pesagem e revisão de ocorrências.
- Conflitos de horários, descanso, pausas e redistribuição assistida.
- Fila de premiação com controle de entrega.
- Relatórios operacionais e aproveitamento do kit de contingência já existente.

Critério de aceite: operador identifica a próxima ação sem buscar em vários menus; pódios derivam dos resultados; entrega e encerramento ficam rastreáveis.

### 4. Expansões conforme demanda

Portal do professor, inscrições em lote, credenciais de técnicos, lista de espera, filiação e formatos adicionais como festival/GP. Não são pré-requisitos universais para todo campeonato.

## Fontes consultadas

- iLutas: https://www.ilutas.com.br/Admin/Painel.php
- Configuração: https://www.ilutas.com.br/Admin/Cadastro/Evento/Configuracao/?event=9e804080e75afec5a34530d9aa5935d1
- Equipes: https://www.ilutas.com.br/Admin/Secretaria/Equipe/
- Secretaria: https://www.ilutas.com.br/Admin/Secretaria/Pessoa/
- Chaves: https://www.ilutas.com.br/Admin/chaves
- Pesagem: https://www.ilutas.com.br/Admin/pesagem
- Resultados: https://www.ilutas.com.br/Admin/resultados
- Tarefas: https://www.ilutas.com.br/Admin/Tarefa
- Código local: `app/admin/page.tsx`, `app/admin/_components/EventoForm.tsx`, `app/admin/chaves/page.tsx`, `app/admin/tatames/page.tsx`, `app/admin/financeiro/page.tsx`, `app/inscricao/page.tsx`, `app/evento/[id]/checagem/page.tsx`, `app/staff/checkin/page.tsx`, `app/lib/cronograma.ts`, `app/lib/ranking-eventos.ts`.
