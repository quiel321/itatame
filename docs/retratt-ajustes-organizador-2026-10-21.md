# Ajustes do organizador — 21/10/2026

Última publicação conferida: 78ae563f5abcb445b7ef27fa3bedd626c5d26ea9 com implantação concluída. Revisão do PDF fornecido pelo usuário.

- Abertura /organizador usa foto local de jiu-jitsu (CC0, já utilizada no site), substituindo o serviço externo e reduzindo a máscara que ocultava a imagem.
- Layout compartilhado mantém o componente do painel montado durante a navegação pelas seis áreas. A autenticação e os dados gerais não são consultados novamente a cada clique; consultas independentes da primeira carga executam em paralelo. Atualizar painel refaz a conferência. Mudança de conta/saída reinicia a carga; resultados de cargas encerradas são ignorados.
- Mercado Pago: endpoint autenticado e somente leitura para conferir tarifas e líquido das diárias recebidas pelo organizador. Pagina 20 pedidos, consulta quatro por vez, valida pagamento, referência, valor e recebedor. Não renova OAuth nem altera pedidos/pagamentos. O financeiro e a tela de pedidos exibem cobertura e avisam quando a soma é parcial. Valor desconhecido não vira zero; a comissão não é descontada outra vez do líquido informado pelo MP. Royalties recebidos pelo fotógrafo não são somados como recebimento do organizador.
- Foto do fotógrafo: usa foto_url já cadastrada; iniciais e indicação de ausência quando não houver foto, com fallback se a imagem falhar. Leitura do cadastro real constatou que os dois profissionais mostrados no PDF não tinham foto cadastrada; nenhum perfil foi modificado.
- Editor assistido: estudo separado de viabilidade, sem ativar modelo, processar mídia de cliente ou modificar o fluxo de upload.

Validação: TypeScript, ESLint sem erros, oito testes de acompanhamento/diárias/tarifas incluindo autorização, somente leitura, centavos, pagamento divergente e indisponibilidade do MP. Prévia isolada desktop e mobile, navegação persistente e imagem do perfil (dado fictício); gravações bloqueadas. Comparação por AST confirma funções de mutação do organizador inalteradas.

Limite da conferência: tarifas reais dependem de a conta conectada continuar autorizada e o MP devolver seus dados. Falhas permanecem identificadas como pendência; o código não inventa taxas nem altera o histórico. Não foi realizado pagamento ou compra real para validar.
