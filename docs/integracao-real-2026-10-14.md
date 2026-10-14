# Integração da operação real — 14/10/2026

Continuação da atualização de código registrada em `atualizacao-real-sem-sql-2026-10-14.md`. Após autorização adicional, estrutura aditiva instalada no projeto iTatame `sivdvcuggjswfcuzrvgs`, schema `public`, enquanto não havia chaves geradas.

## Preservação

Instalação transacional com guarda de ausência de chaves e comparação de contagens e hashes dos registros existentes antes/depois. Resultado idêntico: 1 evento, 51 inscrições, 19 categorias, 0 chaves, 0 credenciais staff e 51 atletas vinculados. Nenhum cadastro, pagamento, inscrição, categoria, data ou PIN alterado. Não foram geradas chaves nem executados testes operacionais em produção.

Novas tabelas de controle/auditoria com RLS; funções exigem organizador ou sessão staff válida do evento. Política restritiva impede alteração de lutas por uma conta autenticada sem vínculo com o evento. Nenhuma contratação ou mudança de plano.

## Fluxo

- Organizador pode criar PIN de Operação completa: Recepção/Pesagem e Chamada/Tatames no mesmo acesso. PINs separados continuam disponíveis.
- Recepção registra chamadas, ausência explícita e pesagem por inscrição. Fechamento exige resolver os pendentes; despacha a categoria e trata os avanços por ausência. Reabertura pelo organizador é limitada ao estado ainda não operado.
- Chamador trabalha com categorias despachadas, confirma presença no tatame e mantém autonomia de chamada/W.O. Transferências e atualizações seguem sincronizadas.
- Geração mantém algoritmo e horários configurados. Novas chaves ficam como rascunho; organizador revisa posições iniciais e publica por categoria. Público/telão só recebem categorias publicadas. Geração não executa resultados de luta.

## Validação

TypeScript e compilação de produção passaram. Testes isolados do SQL de produção: instalação idempotente, preservação de registros, restrição de permissões, check-in por inscrição, fechamento/ausência, triangular, revisão/publicação e bloqueio de mudanças após operação. Testes mobile do aplicativo com banco fictício e rede interceptada: recepção/chamador e revisão/publicação. Regressões de idade competitiva, cancelamento/pagamento, identidade, ranking, 100 atletas e avanço pendente passaram. Nenhum desses testes usou dados reais.

SQL consolidado em `supabase/operacao-integrada-instalacao.sql`; não executar após gerar chaves, pois a guarda interrompe a instalação nessa condição. Não usar o SQL do ensaio no banco real.

