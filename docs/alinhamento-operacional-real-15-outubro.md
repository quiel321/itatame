# Alinhamento operacional com o ensaio — 15/10/2026

Autorizado pelo usuário para o iTatame real. Integração seletiva: preserva inscrição de professor/responsável, identidade de dependentes, exceção de sexo, pagamentos, geração automática e cron.

Recepção: quatro filtros, categorias na sequência dos tatames, validação de distribuição salva, atualização sem perder a seleção e aviso separado quando despacho foi salvo mas avanços ficaram pendentes.

Operação: reprovados e ausentes não entram em chamada, baia nem placar; proteção adicional no banco. Avanços definitivos não são reabertos. Reprocessar avanço idêntico preserva uma próxima luta operada; alterar participante real continua bloqueado. Chave pública indica desclassificação somente nas categorias publicadas, sem dados de contato ou documentos.

Organizador: publicação de todos os rascunhos em transação, mantendo publicação individual e auditoria. Placar: ajuste de tempo pausado, gravação conferida antes de anunciar vitória e proteção contra pedidos duplicados; falha auxiliar de avanço não transforma resultado salvo em falso erro. Nomes quebram linha; rótulo público usa avanço sem luta.

Banco: supabase/operacao-alinhamento-ensaio-real.sql instala somente funções, gatilhos e leitura interna de metadados de publicação. Conferência antes/depois retornou dados_preservados=true, 13 tabelas e zero lutas existentes no evento. Nenhuma geração, publicação, pesagem, resultado ou redefinição de dados reais executada. Definição anterior das funções salva localmente em tmp/backup-funcoes-real-15-outubro.json.

Validação: build Next.js 16.2.6 e TypeScript; 34 testes de regressão (incluindo 100 atletas, ranking, pagamentos e exceções existentes); instalação idempotente em PostgreSQL isolado; publicação em lote com rollback, proteção de tatames, elegibilidade e avanços idempotentes. Build real testado em localhost com toda comunicação de dados interceptada e atletas fictícios: quatro combates completos, empate com decisão do árbitro, finalização tripla, pausa/retomada, avanço e medalhas; reprovados excluídos da operação e sinalizados na chave pública; nomes sem cortes; publicação em lote mobile.

Diferenças intencionais: autenticação, configuração do banco, banner e bloqueios próprios do treinamento, RPC de medalhas e correções de inscrição/administração exclusivas do real. Não copiar a configuração do ensaio para produção.
