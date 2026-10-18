# Seleção de estado e cidade no Retratt

Os formulários de perfil e de galeria do organizador e do fotógrafo oferecem os 26 estados e o Distrito Federal. O estado pode ser selecionado na lista ou pesquisado por nome ou sigla, sem exigir acentos.

Depois de selecionar a UF, a cidade lista apenas municípios daquele estado, usando a base local já utilizada pelo sistema. Trocar a UF limpa a cidade anterior; texto incompleto ou cidade de outro estado não vira uma seleção válida. Cadastros existentes continuam sendo carregados sem alterações automáticas.

O componente compartilhado CidadeEstadoInput mantém seu comportamento anterior por padrão. A seleção por estado é opcional e foi ativada somente nos formulários do Retratt. Nenhuma migração ou alteração de dados foi necessária.

Validação: testes das 27 UFs, busca por nome/sigla, municípios por estado e correspondência exata; TypeScript e lint dos componentes; teste visual em largura de celular com seleção, troca de UF e carregamento de cadastro existente.
