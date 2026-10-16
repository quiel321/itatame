# Auditoria de horários e zona de tatame — iTatame real

Conferência em 15/10/2026. Somente leitura: código publicado, referência local do ensaio, catálogo da API e campos de planejamento do campeonato. Nenhuma função de operação foi executada; não foram alterados atletas, inscrições, PINs, chaves, chamadas ou horários.

## Versão em produção

Repositório `quiel321/itatame`, commit `66938679387cb88e3c48472185dd6846a6be4de5`, com Vercel success. Os arquivos publicados de Organizar tatames, Recepção, Chamador, Painel do mesário e Placar correspondem às versões antigas da raiz local. A referência do ensaio contém as melhorias de `fa0d7d5`, `6bd0112` e `3e67aac`. A comparação não equivale a uma nova execução operacional do ensaio ou do campeonato real.

## O que falta integrar

| Item | Real confirmado | Referência do ensaio / trabalho necessário |
| --- | --- | --- |
| Cálculo de horários | Soma tempo de luta e transição; início sugerido de 09:00 | Planejador com prévia; descanso por possíveis participantes das fases anteriores no mesmo tatame; padrão de um tempo de luta antes das rodadas e dois antes da final; sem contar avanços estruturais como combates |
| Margens | Somente transição entre lutas | Padrões configuráveis: 2 minutos de transição, 5 entre categorias, 10 de reserva final. Não somar duas vezes a parcela já coberta pela transição |
| Horário anunciado por categoria | Não há metadado específico | Início opcional por categoria; usar a data/fuso do evento; nunca antecipar a categoria e alertar quando a fila estimada ultrapassar o horário anunciado |
| Recepção e Chamador | Fila/controles existentes, sem o painel novo | Próxima categoria por tatame, programação completa expansível, horário previsto e estimativa; leitura periódica; sem aprovar, chamar ou despachar automaticamente |
| Áreas oficiais | Banco ainda usa `Tatame 1` como default; gerador publicado não explicita área nula | Remover default; novas lutas com tatame/ordem/horário nulos; aceitar apenas áreas vinculadas a postos de mesário e mostrar valores desconhecidos como não distribuídos |
| Banco da programação | Ausentes `categorias_evento.inicio_lutas_previsto` e `salvar_programacao_categorias` | Adaptar SQL do ensaio para `public`, preservando concorrência e travas. Compatibilizar a proteção de categoria utilizada apenas para o novo metadado de horário |

Arquivos de referência que ainda não existem na árvore publicada do real:

- `app/lib/programacao-categorias.ts`
- `app/lib/descanso-programacao.ts`
- `app/lib/tatames-oficiais.ts`
- `app/components/staff/ProgramacaoLutas.tsx`

Também precisam ser integradas seletivamente as alterações em `app/admin/tatames/page.tsx`, Recepção, Chamador e gerador de chaves. Não copiar configuração, credenciais, schema nem helpers exclusivos do ensaio.

## O que já existe no real

- Salvamento de distribuição/sequência: função `salvar_planejamento_tatames` presente.
- Recepção e gravação de pesagem: `recepcao_operar` e `recepcao_salvar_checkin` presentes.
- Publicação de rascunhos em lote: `chaves_publicar_todas` presente.
- Verificação de área/sequência: `tatame_luta_valido` e `tatames_categoria_pronta` presentes.
- Transferência entre tatames: `transferir_luta_tatame` presente. O código já solicita essa função e confere mudanças de área. A adaptação de 15/10 documenta preservação de participantes, presença, chamadas e liberação. Esta auditoria confirmou presença no catálogo, sem executar transferência nem reinspecionar o corpo da função no banco.
- Mesário/placar não precisam ser substituídos integralmente pelo ensaio; as diferenças verificadas nesses arquivos são de schema/helper exclusivos do treinamento.

## Configuração atual do 3º Campeonato Interno Spartan

Evento `7885981f-90e7-41ad-86f2-2bd328a7088c`, banco real `sivdvcuggjswfcuzrvgs`. Consulta autenticada de leitura com chave de serviço, sem depender das restrições de leitura anônima.

- 58 registros de luta; todos com status `agendada`.
- Todos apresentam `Tatame 1`.
- 58 sem `ordem_tatame` e 58 sem `horario_estimado`.
- Nenhum posto de mesário cadastrado nesse evento.

O valor atual de `Tatame 1` não constitui distribuição oficial salva. Mesmo depois da integração, o organizador ainda precisará cadastrar as áreas/postos, escolher distribuição e sequência e aplicar os horários. Não criar PINs, distribuir categorias ou preencher horários automaticamente durante a instalação.

## Sequência para uma aplicação futura

1. Adaptar e validar o pacote de programação e áreas oficiais para o real, sem substituir as regras de cadastro/inscrição já corrigidas.
2. Preparar migração aditiva: novo campo inicialmente nulo, RPC transacional, compatibilidade do trigger de categorias e remoção do default para novas lutas.
3. Conferir antes/depois a preservação de registros; não executar os scripts de limpeza/reinício nem os scripts com evento/schema do ensaio.
4. Publicar o código correspondente após a instalação compatível do banco.
5. O organizador configura áreas/postos, distribuição, sequência e horários do campeonato.

A remoção do default só afeta novas lutas. Reavaliar os valores antigos desconhecidos pela interface; não limpar nem regravar a distribuição existente sem decisão do organizador. As correções do PDF feitas nesta conversa continuam locais e não estão no commit de produção acima.
