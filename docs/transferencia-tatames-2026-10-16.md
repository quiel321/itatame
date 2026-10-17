# Destinos da transferência de tatame

As duas áreas do evento temporário estão cadastradas e acessíveis aos postos vinculados. O painel descartava erros da consulta e mantinha uma lista vazia, apresentada como “Nenhum outro tatame configurado”. Abrir a transferência e atualizar o painel não repetiam essa consulta.

A lista agora é consultada ao abrir a transferência e ao atualizar o painel. O vínculo do posto precisa ser confirmado antes da leitura. Carregamento, erro e ausência real de outro destino têm estados distintos; existe um botão para repetir a consulta. Resposta sem nenhum posto também exige conferência de acesso, pois o próprio mesário deveria constar na lista. Durante o envio, os botões de destino ficam desabilitados.

Validação no Chrome, desktop e celular, com banco e transmissões em tempo real interceptados: consulta inicial indisponível, recuperação ao abrir o modal, falha e repetição, vínculo recusado, resposta vazia, apenas a própria área e transferência simulada nos dois sentidos. IDs, participantes, chamada, placar e status foram preservados nas simulações. Consulta do banco com cada papel de mesário confirmou a leitura das duas áreas.

Nenhuma alteração de função SQL, cadastro, PIN, área, atleta ou luta foi necessária. Backup anterior e evidências locais em `tmp/transferencia-tatames-20261016/`.
