# Busca no portfólio e reconhecimento em vídeos

O portfólio público oferece busca por selfie em todas as galerias públicas do organizador. A API valida o identificador e restringe no servidor os eventos e mídias publicados, excluindo galerias restritas por link. A busca anterior por galeria ou cidade permanece disponível. Fotos e vídeos usam o mesmo carrinho e as prévias protegidas existentes.

O limite de resultados é aplicado após a restrição ao organizador: muitos resultados globais não eliminam antecipadamente um vídeo daquele portfólio. Selfies não são persistidas. Os filtros públicos e preços não foram alterados.

Vídeos eram indexados como uma montagem de seis quadros em uma só imagem de 960×810. Agora cada quadro é indexado separadamente, mantendo o identificador do vídeo e acrescentando vetores aos anteriores. O progresso fica no índice privado de IA, permitindo retomar falhas sem apagar rostos existentes. Próximos uploads usam quadros maiores com o enquadramento completo, inclusive vídeos verticais. A falha opcional de decodificação continua permitindo publicar o original, com aviso de indisponibilidade da busca facial quando só há capa padrão.

Os seis vídeos publicados da Spartan receberam a complementação dos seus índices. Uma verificação real com o último quadro de cada vídeo confirmou o retorno dos seis pela busca do organizador. Isso verifica a ligação entre quadro, índice e resultado, sem garantir reconhecimento de toda pessoa em qualquer trecho do vídeo. Nenhum original, prévia, autoria, preço, pedido ou pagamento foi modificado nesse procedimento.

O cartão de galeria usa a mesma grade compacta com uma ou várias galerias, até quatro por linha no desktop. O compartilhamento do portfólio prioriza a imagem do perfil e preserva o logo inteiro na prévia; capas de galerias mantêm seu comportamento anterior. O botão Compartilhar site acrescenta a versão do perfil ao link para renovar a prévia quando a imagem muda; o endereço canônico permanece curto.

Validação: TypeScript, ESLint, testes de isolamento entre organizadores, mídias de vídeo após muitos resultados globais, retomada e idempotência da indexação, enquadramento vertical, prévia de logo e regressões de uploads, galerias privadas e compartilhamento. Simulação visual do portfólio e modal em desktop e 390 px.
