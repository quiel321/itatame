# Arquivos públicos no R2 — iTatame e Retratt

## Destinos separados

- iTatame: bucket `itatame-publico`, configurado por `R2_ITATAME_BUCKET_NAME`.
- Retratt: bucket existente `itatame-fotos` (nome legado), configurado por `R2_RETRATT_BUCKET_NAME` ou `R2_BUCKET_NAME`. Ele contém as fotos e vídeos do Retratt e continua privado.
- Não se permite configurar o iTatame com o mesmo nome de bucket do Retratt. Credenciais e endpoints também podem ser separados com `R2_ITATAME_ACCESS_KEY_ID`, `R2_ITATAME_SECRET_ACCESS_KEY`, `R2_ITATAME_ENDPOINT` e os equivalentes `R2_RETRATT_*`.
- A credencial antiga só possui acesso ao bucket legado. Uma credencial de objetos exclusiva do iTatame é necessária para habilitar o novo destino.

Não tornar o bucket do Retratt público: ele armazena originais vendidos. As rotas de compra e download mantêm a autorização existente.

## Entrega e velocidade

Uploads públicos são processados no servidor com Sharp: avatar de até 500 px, banner de até 1280 px e capa de até 1920 px, mantendo a proporção e usando WebP. PDFs mantêm seus bytes. A conversão acontece uma vez, no upload, sem processamento de imagem durante a navegação.

Os nomes são hashes SHA-256 dos bytes e nunca são sobrescritos por outro conteúdo. A URL pública tem cache de um ano com `immutable`; uma edição gera URL nova. Reenvios idênticos compartilham o objeto no mesmo bucket. Falhas não ficam em cache.

Sem domínio dedicado, `/api/midia-publica/itatame/<hash>.webp` ou `/api/midia-publica/retratt/<hash>.webp` transmite o objeto do R2, sem consulta ao banco, e permite cache compartilhado pela CDN da hospedagem. As assinaturas S3 ficam no servidor. O endpoint só permite o namespace `midia-publica/v1/` e arquivos `WebP`/`PDF`, nunca chaves de originais. PDFs aceitam Range; respostas parciais não usam cache compartilhado. O tráfego dessa modalidade passa pela hospedagem e deve ser acompanhado nos limites dela.

Para entrega direta pela Cloudflare, configurar um domínio de produção no bucket **exclusivo de arquivos públicos** e preencher `R2_ITATAME_PUBLIC_BASE_URL`. O domínio `itatame.com.br` não pertence à zona Cloudflare desta conta; não foi alterado seu DNS. Não configurar `R2_RETRATT_PUBLIC_BASE_URL` apontando para o bucket dos originais. A URL `r2.dev` não é indicada para campeonatos em produção.

Uploads via formulário têm limite de 4 MB para respeitar o limite do corpo das funções da hospedagem. Imagens são preparadas no navegador antes do envio e conferidas no servidor. PDFs maiores precisam ser reduzidos antes de enviar. Arquivos antigos da migração podem ter até 20 MB.

## Migração dos arquivos antigos

O script não apaga objetos no Supabase. Somente referências dos buckets públicos `avatars` e `eventos`, no projeto configurado, são elegíveis. Não copia fotos vendidas, URLs assinadas, URLs externas nem buckets privados. O inventário de 28/10/2026 identificou 31 referências do iTatame e 15 do Retratt (referências podem compartilhar o mesmo arquivo).

1. Configurar as credenciais e os buckets separados no ambiente local e na hospedagem. Publicar o código das rotas e dos novos uploads.
2. Executar inventário: `npx tsx scripts/migrar-midias-publicas-r2.ts`.
3. Copiar, conferir os hashes e gerar plano/retorno: `npx tsx scripts/migrar-midias-publicas-r2.ts --copiar --escopo=itatame --plano=output/midia-publica-r2/itatame.json`.
4. Repetir com `--escopo=retratt --plano=output/midia-publica-r2/retratt.json`.
5. Depois de publicar as rotas, executar `--aplicar` com os mesmos escopo e plano. Antes de alterar qualquer registro, o script confere a leitura e os hashes de **todos** os destinos públicos e o cabeçalho de cache. Não prossegue se o destino ainda não estiver disponível.
6. A troca compara a URL original para preservar edições concorrentes. O plano é salvo a cada cópia e alteração para permitir retomar em caso de interrupção.
7. `--reverter` com o mesmo plano restaura os links anteriores, também comparando a URL atual. Não apaga nenhuma cópia. Guardar os planos em local privado e não versioná-los.

Depois da publicação, conferir upload de banner, PDFs, avatares (titular e dependente), logo de equipe e academia e capas/perfis do Retratt. Validar visualmente os arquivos e o cache no domínio final, incluindo visitas repetidas. Uma visita nova ainda depende da rede e da latência do primeiro acesso ao R2; cache e compressão reduzem esse custo, sem prometer ausência de lentidão.

## Validação executada

Os 15 arquivos públicos do Retratt foram copiados para `midia-publica/v1/` no bucket dele e conferidos por SHA-256. O peso total passou de 27.348.867 bytes para 1.542.136 bytes (redução de aproximadamente 94%). O bucket `itatame-publico` foi criado e recebeu credencial exclusiva, autorizada pelo usuário, limitada a leitura e escrita de objetos nele. As 31 referências do iTatame também foram copiadas e verificadas: de 4.018.812 para 930.954 bytes (redução de aproximadamente 77%). A credencial e os nomes dos buckets estão configurados no ambiente local e como segredos na Vercel, em Production e Preview. Nenhum objeto original foi apagado. Os links do banco permanecem preservados até a publicação e verificação das novas rotas.

Build de produção aprovado; 16 testes de comportamento passaram, cobrindo compressão, destinos independentes, cache, PDFs, bloqueio de acesso a originais, autenticação e permissões de upload. A aplicação em produção, o cache real da CDN e a latência final ainda precisam ser validados depois da configuração/publicação.
