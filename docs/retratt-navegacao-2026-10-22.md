# Navegação do Retratt — 22/10/2026

## Gargalos e correções

- Links internos ainda usavam `/fotos` no domínio Retratt e atravessavam um redirecionamento 308. Um adaptador compartilhado de Link e router usa os caminhos públicos diretamente nesses domínios. No Itatame, mantém o prefixo. Parâmetros, âncoras e links externos são preservados.
- As páginas de gestão do fotógrafo remontavam o painel e consultavam novamente perfil, contagens e galerias. O layout agora mantém o painel durante a troca dos cinco menus. Entrada inicial, troca de usuário e atualização explícita continuam verificando a sessão e carregando os dados.
- Financeiro e vendas permanecem montados, com carregamento apenas quando ativos. Retornar ao financeiro reaproveita o extrato já obtido; os botões de atualização consultam novamente. Consultas abandonadas de pedidos são canceladas, e seu modal fica fechado nas outras seções.
- A navbar repetia a identificação do perfil no evento inicial da autenticação. Agora faz uma leitura inicial e consulta as tabelas em paralelo, descartando respostas antigas após logout.
- As páginas públicas dinâmicas de organizador e fotógrafo passam a ter uma indicação de carregamento durante a navegação.

## Verificação

- TypeScript sem erros; ESLint dos componentes estruturais sem erros (oito avisos preexistentes de imagens HTML).
- Nove testes de navegação, acesso, datas e financeiro aprovados.
- Prévia privada com Supabase e APIs simulados, somente GET: cinco menus, financeiro direto e diária, voltar no navegador e preservação do nome digitado sem salvar. Layout conferido em celular e desktop.
- O registro da prévia permite conferir que o perfil e o financeiro direto não são buscados novamente apenas pela troca de menu.
- Nenhuma mudança em APIs de pagamento, valores, permissões de galeria, banco, preparação de arquivos ou fila de upload. Na página de upload, somente os adaptadores de navegação foram aplicados.

## Limites

O primeiro carregamento depende da rede e das consultas reais, inclusive Mercado Pago. Dados retidos representam o último carregamento; use os botões de atualização para uma nova consulta. A validação autenticada foi feita com dados fictícios, sem simular compras na produção.
