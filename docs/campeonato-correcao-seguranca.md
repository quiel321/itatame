# Correções de segurança para o campeonato

A instalação das funções foi confirmada pelo organizador em 11/10/2026 e conferida por consulta ao schema do Supabase. Nenhuma função de geração foi executada no campeonato real durante a validação. Não foram criados postos, geradas chaves reais ou alterados atletas, inscrições, pagamentos e resultados existentes.

## O que muda

- Publicar o ranking libera os resultados calculados das chaves sem somar medalhas novamente nos cadastros. O registro de resultados pelo placar permanece como estava. Não há reparo retroativo de estatísticas.
- As duas rotas de cobrança usadas pela tela de pagamento conferem o prazo antes de preparar uma nova cobrança. Retornos de pagamentos existentes, webhooks e estornos permanecem como estavam. Pix já emitidos não são cancelados nem têm sua validade alterada; podem continuar sendo confirmados pelo provedor.
- A geração manual usa a função transacional já existente, com substituição limitada ao tipo solicitado e proteção para lutas iniciadas. Se houver período de checagem configurado, ele precisa ter terminado.
- A geração automática utiliza uma função nova que bloqueia o evento durante a transação, verifica as datas e preserva as chaves quando outra chamada já as criou. Não há fallback para apagar/inserir em operações separadas.
- A geração automática não reconstrói chaves existentes, inclusive as de eventos antigos. Eventuais ajustes continuam sob controle do organizador.
- O cron diário foi movido para 23:30 UTC (19:30 de Mato Grosso). As páginas do evento e das chaves também consultam automaticamente quando chega a divulgação, inclusive se já estavam abertas. Uma falha temporária na consulta é tentada novamente, até quatro tentativas.

## Validação sem dados reais

```powershell
node node_modules/tsx/dist/cli.mjs --test tests/campeonato-100.test.ts tests/campeonato-seguranca.test.ts tests/evento-datas.test.ts tests/chaveamento-primeira-luta.test.ts tests/chave-de-tres.test.ts tests/absoluto-categorias.test.ts tests/checagem-lista.test.ts tests/cancelamento-pagamento.test.ts
```

São 63 testes. As duas simulações de 100 atletas percorrem montagem, avanços, finais e cálculo do ranking com dados em memória. Não substituem um ensaio de equipamentos e permissões de staff.

As funções SQL foram executadas em PostgreSQL isolado em memória: criação concorrente sem duplicar, preservação de peso/absoluto, rollback na falha de inserção, bloqueio de luta iniciada e validação das datas.

## Antes de ativar em produção

1. Conferir as alterações locais e liberar a publicação.
2. Instalar as definições de `supabase/blindar_chaves.sql` e `supabase/chaves_criacao_automatica_segura.sql`. São definições de funções; não chamar essas funções nesta instalação nem gerar chaves para testar no evento real.
3. Configurar/conferir `CRON_SECRET` na Vercel e verificar que o cron está ativo. O código recusa o cron sem essa credencial.
4. Publicar o código e conferir os logs. Sem a função nova, a geração automática falha com segurança, sem apagar chaves.

## Procedimento do organizador em 14/10

- Até 19h: concluir a checagem e conferir inscritos confirmados, grupos com um só atleta e pagamentos pendentes, sem gerar antecipadamente.
- A partir de 19h30: abrir a página das chaves. A geração é automática; não é necessário clicar em gerar. Se a aba já estiver aberta, a consulta é agendada para esse horário. Na hospedagem Hobby, o cron não garante execução no minuto exato, por isso o acesso à página é o caminho recomendado para acompanhar a divulgação.
- Conferir as chaves, atribuir tatames e montar o cronograma para a divulgação prevista às 20h. A geração não configura staff nem distribui automaticamente os tatames.
- Usar a geração manual apenas como alternativa, após conferir a mensagem de erro, os logs e a prévia. Não usar regeneração para resolver pagamentos recebidos depois das chaves sem revisar a organização.

Documentação do limite de precisão do cron: https://vercel.com/docs/cron-jobs/usage-and-pricing

