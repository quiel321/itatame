# Programação de categorias no iTatame real

Implantação autorizada pelo organizador em 16/10/2026, preservando os registros.

- Migração: `supabase/programacao-categorias-real.sql`.
- Conferência transacional das 35 tabelas públicas: quantidades e conteúdo idênticos antes/depois, com bloqueio de escritas durante a conferência.
- Novo início previsto opcional por categoria e salvamento atômico com o planejamento existente; somente o organizador do evento pode executar.
- Proteção original das categorias em uso mantida para alterações de outros campos e exclusões. Ajustes de início bloqueados em tatames com operação iniciada.
- Retirado somente o padrão automático de tatame nas novas inserções. Registros existentes não foram atualizados.
- Spartan: 58 chaves agendadas, todas com o tatame legado `Tatame 1`, todas sem sequência e sem horário; nenhum mesário cadastrado. Situação preservada após a instalação.
- Cadastro de mesários/áreas, distribuição, sequência e horários continuam sob decisão do organizador. Abrir o planejamento não processa avanços nem grava dados.
- Recepção e chamador exibem a programação em painel de leitura, atualizado a cada 20 segundos.
- Estimativas incluem tempo de luta, transição, margem entre categorias, reserva final e descanso possível dos participantes, sem contar avanços estruturais como combates.

Validação: 50 testes de regressão passaram, incluindo simulação de 100 atletas, hierarquia de resultados, fotos, cidades, sequência, descansos e formatos das chaves. Migração executada repetidamente em banco isolado, com testes de autorização, concorrência, rollback e proteção da operação. Compilação de produção e TypeScript passaram. Lint dos arquivos novos de programação e do planejamento passou; componentes antigos de recepção/chamador contêm avisos/erros preexistentes fora das mudanças.

Validação de interface em ambiente isolado: três categorias fictícias distribuídas em área oficial, sequência por idade/peso salva, prévia calculada e programação aplicada. Contagem de escritas: uma de sequência, uma de programação e zero inesperadas. Nenhum teste operacional foi executado contra os registros reais.

Esta publicação inclui também as correções solicitadas no PDF: municípios disponíveis localmente, rótulo Cronograma, proteção e busca nos resultados manuais, publicação das chaves após salvar, seleção compacta de categorias e fotos dos atletas.
