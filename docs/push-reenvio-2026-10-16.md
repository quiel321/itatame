# Reenvio confirmado da programação

O organizador pode conferir novos avisos ou a prévia de um reenvio dos avisos já registrados para a programação atual, publicada e futura. A prévia mostra amostra por atleta, contas de atletas e responsáveis, aparelhos cadastrados e avisos sem aparelho cadastrado. Uma conta pode acumular os dois papéis; endpoints iguais são contados uma vez. Cadastro não comprova entrega nem leitura.

Reenvio exige autenticação do dono do evento, versão atual da prévia, confirmação geral e confirmação específica de repetição. O servidor acrescenta outro lote à fila existente por `upsert` com `ignoreDuplicates`; não edita ou apaga os avisos e recibos anteriores. A chave determinística da prévia protege contra requisições concorrentes repetidas. Uma nova prévia após o lote muda a versão, e existe intervalo de cinco minutos entre reenvios. Avisos ainda pendentes/processando ficam fora do reenvio. A versão inclui a seleção, de modo que mudanças de estado não ampliem silenciosamente a confirmação.

O worker mantém a validação da programação atual também para reenvios; se horário, área, publicação ou elegibilidade mudarem antes do processamento, o aviso antigo deixa de valer. Destinatários continuam sendo a conta do atleta e do responsável, com deduplicação por aparelho em cada aviso. Uma nova intenção pode repetir uma notificação anteriormente recebida, como informa a confirmação.

No perfil foi removido o teste individual de push e seus controles; restaram a ativação, situação e orientação de permissões. Nenhuma assinatura existente foi revogada ou renovada. A rota de teste permanece autenticada e sem acionamento pela interface.

Validação: 34 testes de prévia, autorização, confirmação adicional, versão, intervalo, destino por responsável/dependentes, deduplicação, worker e navegação/ativação. SDK de envio simulado nos testes; nenhum push real disparado. Conferência da prévia do Spartan em 16/10/2026 via cliente limitado a GET/HEAD: 56 avisos de reenvio, zero novos, zero pendentes, 18 avisos com aparelho cadastrado e 38 sem; 11 contas distintas e 13 aparelhos. Esses números são uma fotografia e podem mudar quando usuários ativarem avisos.

Nenhuma migração ou alteração de dados reais foi executada na implantação. Os arquivos substituídos foram copiados previamente para `tmp/push-reenvio-20261016/antes`. O reenvio real somente ocorrerá quando o organizador confirmar pelo painel.
