# Compra conjunta de fotógrafos com recebimento pelo organizador

No modelo diária, um comprador pode pagar arquivos de vários fotógrafos da mesma galeria em uma única transação. O dinheiro é recebido na conta Mercado Pago conectada do organizador, mantendo a comissão da Retratt e as tarifas do provedor. O organizador paga os fotógrafos externamente conforme o acordo entre eles.

## Ativação pelo organizador

1. Em Retratt > Organizador > Receitas de fotos, conectar a conta Mercado Pago da organização.
2. Na galeria, configurar cada fotógrafo envolvido como **Diária: organizador recebe a venda** e salvar cada vínculo.
3. Todos os autores de um carrinho misto precisam estar ativos e credenciados como diária na mesma galeria. Royalties, vínculos ausentes/inativos, galerias distintas e galerias sem organizador continuam impedindo a compra conjunta.
4. A configuração é feita pelo organizador. Esta implantação não alterou vínculos, contas recebedoras ou vendas reais.

## Registro financeiro e conferência

- O servidor calcula o desconto com as regras da galeria; somente fotos são elegíveis, preservando a regra existente. No pedido conjunto por diária, a quantidade elegível abrange os fotógrafos da mesma galeria.
- A nova coluna nullable `foto_pedidos.vendas_fotografos` guarda, para novos pedidos de diária, autor e nome no momento da compra, quantidade, preço dos arquivos, desconto atribuído, venda após descontos, comissão da Retratt e valor antes da tarifa do Mercado Pago.
- Descontos são distribuídos proporcionalmente ao preço das fotos elegíveis de cada autor. A comissão é distribuída proporcionalmente à venda após desconto. O método de maiores restos conserva todos os centavos, com desempate estável por ID de autor.
- Pedidos conjuntos não atribuem toda a venda a um fotógrafo: `fotografo_id` fica nulo quando há mais de um autor. O recebedor continua sendo determinado pelo modelo e organizador armazenados no pedido. Processamento, consulta, webhook e downloads já suportam esse caminho de diária e não foram modificados.
- O relatório **Vendas por fotógrafo · Diária**, em Receitas de fotos, mostra apenas pedidos pagos, por galeria e fotógrafo, com atualização manual e exportação CSV. Não mostra dados de outros organizadores nem inclui pedidos de royalty, pendentes, cancelados ou reembolsados.
- Pedidos antigos permanecem sem o novo registro. Caso haja diária antiga, a conferência usa os preços dos itens e os totais/comissões já armazenados; não consulta regras atuais de desconto nem grava alterações retroativas.
- Os valores são **antes da tarifa do Mercado Pago**, não um saldo líquido nem um registro de repasses já feitos. A tela e a planilha explicitam isso. Conferir a tarifa no extrato e o acordo de remuneração antes do repasse.

## Verificações

- 12 testes automatizados: regras de autores/recebedor, conservações e arredondamentos, vídeos sem desconto, registros históricos, autoria divergente, checkout e relatório reais com todas as chamadas externas simuladas.
- TypeScript sem erros.
- Chrome/Playwright: desktop 1440 px e celular 390 px; relatório, ausência de overflow, download CSV, erro de consulta e recuperação, checkout com dois autores em um só pedido. SDK e endpoints de pagamento simulados; nenhuma cobrança real.
- A migração acrescentou apenas uma coluna nullable. Antes e depois: 23 pedidos, zero registros preenchidos retroativamente e mesmo hash dos campos preexistentes (`13abb0cbf27ecd6c3f2a8d11fc877245`).
- Advisors de segurança antes/depois: 40 avisos preexistentes, nenhum aviso novo.
- Backups privados e provas: `tmp/retratt-diaria-20261017/`, ignorado pelo Git. Nenhum dado do campeonato Spartan foi alterado.

## Retorno de versão

Se necessário, retornar somente os arquivos desta mudança para a versão anterior. Preservar a coluna e seus registros após começarem as vendas: não apagar o histórico financeiro. Não publicar outras alterações locais deste workspace.

O split 1:N entre contas distintas continua separado desta funcionalidade e aguarda o atendimento do Mercado Pago.
