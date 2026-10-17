# Galerias, descontos e acesso Retratt — 17/10/2026

O aviso “Em breve” passa a ter um controle visível no cartão de cada galeria do organizador e nos álbuns próprios do fotógrafo, sem abrir o editor. A API exige autenticação e propriedade da galeria e só altera `em_breve`. Uma falha na resposta provoca uma consulta do estado salvo, sem repetir a gravação. O sucesso só aparece quando o estado desejado é confirmado.

O editor dos álbuns próprios também solicita a representação da linha salva e confere os campos pretendidos. Se a resposta se perder, consulta a linha antes de apresentar uma falha. A comparação aceita a ordenação de propriedades de JSONB e mantém diferenças reais visíveis. A atualização confirmada aparece no painel sem recarregar a página.

As faixas de desconto agora ocupam toda a largura abaixo do resumo e se distribuem em uma grade que quebra em linhas. Os quatro níveis, incluindo 20%, ficam visíveis sem rolagem horizontal. Cálculo, elegibilidade e valores dos descontos permanecem iguais.

O checkout deixa de mencionar diária e recebimento do organizador no erro de compra entre autores incompatíveis. O comprador recebe uma orientação para finalizar separadamente por fotógrafo. A restrição do pagamento e a identificação do recebedor continuam em vigor; esta mudança não configura automaticamente galerias nem altera repasses.

O login passa a reconhecer organizadores cadastrados diretamente em `foto_organizadores`, além dos organizadores do iTatame. O perfil é resolvido pelos cadastros vinculados ao usuário autenticado, sem conceder acesso por metadados editáveis. Nenhuma senha ou cadastro foi alterado.

## Validação

- Testes de autenticação/propriedade do controle, edição confirmada, JSONB e perfis de acesso.
- Testes existentes de descontos e rateio financeiro, mantendo as regras anteriores.
- TypeScript sem erros.
- Chrome com dados simulados: controle nos dois painéis, resposta de gravação perdida, falha sem gravação e confirmação do editor.
- Quatro e cinco faixas conferidas em larguras 1366, 1024, 768, 390 e 320 px, sem cortes nem rolagem horizontal.
- Consultas somente leitura para identificar o organizador e conferir os vínculos existentes. Nenhuma cobrança, mensagem, notificação ou alteração de dados reais foi executada na validação.

As evidências privadas ficam em `tmp/retratt-galeria-controles-20261017/`, fora desta publicação.
