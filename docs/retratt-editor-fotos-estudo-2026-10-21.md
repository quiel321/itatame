# Editor assistido de fotos — estudo de viabilidade

Recomendação: um editor opcional antes da publicação, com recorte manual e sugestão de enquadramento, presets de ambiente e redução de ruído moderada. Cada foto precisa de prévia antes/depois e confirmação do fotógrafo. O arquivo original deve permanecer preservado e o tratamento deve gerar uma versão separada, reversível.

## O que pode ser feito com a estrutura atual

- Recorte, proporção, rotação e centralização manual na prévia do navegador. Sem processamento pago a cada movimento.
- Sharp no servidor para aplicar recorte aprovado, exposição, contraste, balanço de cor e preset. A biblioteca já está no projeto. Processar trabalhos em fila e por arquivo, sem prender um lote de centenas de fotos em uma requisição.
- Presets iniciais configuráveis por galeria: ginásio/tatame, externo de dia e luz mista. A aplicação depende de amostras reais do fotógrafo para evitar cor artificial nos quimonos e na pele. Esses presets são uma proposta de produto, não um resultado já calibrado.
- Sugestão de enquadramento: o Sharp tem estratégia attention, uma heurística de brilho/cor/pele, não um detector confiável de pessoas. Para centralizar pessoas, é possível sugerir um enquadramento com caixas de rosto do DetectFaces do Rekognition, já usado na busca. Rostos não delimitam o corpo inteiro: é preciso margem, preservar membros e permitir correção manual; não recortar automaticamente uma luta só pelo rosto.
- Redução de ruído simples com filtros preserva o orçamento, mas pode apagar detalhes finos. Um denoiser por rede neural precisa de avaliação de qualidade, licença do modelo, memória e tempo de processamento. Não recomendar filtro forte ou nitidez automática sem amostra comparativa.

## Fluxo recomendado

Selecionar uma foto → sugerir recorte/preset → ajustar intensidade → comparar antes/depois → aplicar à foto ou às selecionadas → revisar → publicar. O acesso permanece restrito ao dono das mídias; organizador não deve editar os originais de outro fotógrafo sem um fluxo explícito de autorização.

Manter uma receita de edição versionada, gerar nova prévia protegida e derivado, e conservar os arquivos usados em pedidos anteriores. Uma edição posterior não pode alterar silenciosamente aquilo que já foi comprado. Cada ação deve poder ser desfeita. Evitar preenchimento generativo e alterações na aparência das pessoas nesta primeira versão.

## Como validar antes de implementar

Separar amostras autorizadas de ginásio, luz mista, ação rápida e ISO alto. Conferir tons de pele/quimono, mãos/rosto, perda de detalhe, tempo por foto, tamanho final e custo por lote. Testar em desktop e celular; comparar com o original e obter aprovação do fotógrafo. Definir limites e processar em fila com progresso e retomada antes de oferecer aplicação a um lote inteiro.

Não foram instalados modelos, contratados serviços ou processadas fotos de clientes neste estudo. A etapa de editor ficou como estudo, conforme solicitado.

Referências técnicas consultadas em 21/10/2026:
- Sharp, recorte e estratégias: https://sharp.pixelplumbing.com/api-resize/
- Sharp, filtros e ajustes: https://sharp.pixelplumbing.com/api-operation/
- Amazon Rekognition, detecção de rostos: https://docs.aws.amazon.com/rekognition/latest/dg/faces-detect-images.html
