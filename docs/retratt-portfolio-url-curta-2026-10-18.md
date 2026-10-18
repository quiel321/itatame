# URL curta do portfólio

O portfólio passa a aceitar `retratt.com/<slug>`, por exemplo `retratt.com/spartan-jiu-jitsu`. A página antiga em `/organizador/<slug>` continua funcionando e aponta para o endereço curto nos metadados canônicos.

O botão Meu site público, a identificação do organizador na galeria e os links do próprio portfólio usam o caminho curto. Nomes reservados da navegação mantêm o caminho antigo. A rota dinâmica só aceita um segmento e usa o mesmo carregamento público e os mesmos controles de acesso do portfólio anterior.

Não foi necessário modificar o proxy, autenticação, checkout, API, pagamentos ou dados. O domínio iTatame permanece com as rotas anteriores.

Validação: testes de slugs e conflitos com as pastas existentes, encaminhamento do proxy por domínio, preservação de parâmetros privados de galeria, TypeScript e conferência do endereço público após publicação.
