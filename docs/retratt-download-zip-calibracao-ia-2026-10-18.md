# Download de pedidos e seleção facial mais rigorosa

Em Minhas compras há um botão Baixar todas as fotos (.zip) por pedido pago, inclusive os antigos. O ZIP contém os originais das fotos; vídeos mantêm os downloads individuais. Os arquivos individuais continuam disponíveis.

A autenticação é validada pelo servidor, junto da propriedade e do pagamento do pedido. A emissão do link e a entrega conferem novamente liberação, expiração e existência da chave de cada original. O link tem assinatura específica para ZIP, vinculada ao pedido e válida por cinco minutos. Não aceita a assinatura de download individual e não expõe as chaves do armazenamento ao cliente. As solicitações são registradas em foto_downloads como no fluxo individual.

O ZIP é enviado em streaming, sem guardar o pedido inteiro na memória do servidor ou do celular. Usa o formato ZIP padrão, sem recomprimir JPEGs, com CRC32, nomes UTF-8 e prefixos únicos. Erro em qualquer original interrompe o arquivo; não entrega silenciosamente um pacote incompleto. Limites desta versão: 500 fotos, 2 GB de dados e duração máxima de 300 segundos. Downloads individuais são a alternativa para pedidos acima desses limites ou uma transferência interrompida.

A busca facial aceitava similaridade a partir de 75. Agora consulta o provedor a partir de 95 e repete o filtro na API. A seleção principal e a formação de pacotes exigem pelo menos 99. Resultados entre 95 e 99 ficam em Sugestões para conferir, sem seleção em lote e sem participação em combos. Esses limites reduzem falsos positivos e podem deixar de mostrar correspondências verdadeiras. Não representam uma garantia de identidade; as prévias precisam ser conferidas.

As ofertas assinadas passam à versão 2: ofertas antigas não finalizadas exigem uma nova busca, pois podem conter correspondências fracas. Pedidos já gerados e pagos mantêm seus valores e itens. As faixas continuam 10/50%, 15/60%, 25/70%, 35/80%, sempre somente sobre as fotos elegíveis do pacote. Nenhum índice, arquivo original, preço ou resultado de campeonato foi alterado.

Validação: leitura de ZIP por implementação independente e CRC32 conhecido, preservação de bytes e nomes, limite, cancelamento e erro de arquivo; autenticação, propriedade, pagamento, validade, revogação da liberação após emissão do link e exclusão de vídeos; fronteiras dos critérios faciais, exclusão de resultado 79, exclusão de uma sugestão da contagem do combo, invalidação de ofertas antigas e comparação dos valores de carrinho/pagamento. Sem criar pedidos, cobranças ou enviar imagens pessoais para testes.

Referências: [limiares de semelhança do Amazon Rekognition](https://docs.aws.amazon.com/rekognition/latest/dg/thresholds-collections.html), [streaming de respostas na Vercel](https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions).
