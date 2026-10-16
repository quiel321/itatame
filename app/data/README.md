# Municípios do IBGE

`municipios-ibge.json` contém os 5.571 municípios retornados pela fonte oficial em 15/10/2026:
https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome

A UF é identificada pelos dois primeiros dígitos do código de município do IBGE. O conjunto foi validado para conter as 27 UFs e não repetir cidade/UF.

O endpoint `/api/localidades` serve esta cópia verificada para os cadastros iTatame e Retratt. Não depende da disponibilidade ou da cadeia de certificados do serviço externo durante o cadastro. Para atualizar, obter novamente a lista oficial com TLS validado, conferir os códigos de UF, atualizar a data e executar `tests/localidades.test.ts`.
