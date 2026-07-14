import type { Metadata } from "next";
import FotosLegalPage from "../_components/FotosLegalPage";

export const metadata: Metadata = {
  title: "Privacidade | Itatame Fotos",
  description: "Política de privacidade e proteção de dados do Itatame Fotos.",
};

const secoes = [
  {
    titulo: "Dados que tratamos",
    itens: [
      "Dados de cadastro e contato, como nome, e-mail, telefone e perfil de acesso.",
      "Informações de galerias, eventos, fotos, pedidos, valores, repasses e histórico de downloads.",
      "Dados técnicos de segurança, como endereço de rede, navegador, dispositivo, registros de acesso e eventos de falha.",
      "Imagem facial enviada voluntariamente para localizar fotos, quando o usuário ativa a busca por selfie.",
    ],
  },
  {
    titulo: "Como utilizamos os dados",
    paragrafos: [
      "Utilizamos os dados para autenticar usuários, operar galerias, processar pedidos, localizar fotos, liberar downloads, prevenir fraudes, prestar suporte, cumprir obrigações legais e aprimorar a experiência da plataforma.",
    ],
  },
  {
    titulo: "Busca facial",
    paragrafos: [
      "A imagem enviada para busca é utilizada para comparar características faciais com índices das prévias disponíveis e retornar possíveis correspondências. O recurso somente é iniciado por ação do usuário.",
      "Os resultados podem conter diferentes níveis de semelhança e devem ser confirmados visualmente. A foto original de alta resolução não precisa ser exposta publicamente para essa análise.",
    ],
  },
  {
    titulo: "Compartilhamento necessário",
    paragrafos: [
      "Dados podem ser tratados por prestadores de infraestrutura, armazenamento, inteligência facial, comunicação e pagamentos, sempre na medida necessária à execução do serviço. Também poderemos compartilhar informações para cumprir obrigação legal, ordem de autoridade ou proteger direitos e segurança.",
    ],
  },
  {
    titulo: "Armazenamento e segurança",
    paragrafos: [
      "Adotamos separação entre prévias e originais, controles de acesso, autenticação, registros operacionais e entrega controlada de arquivos. Nenhum ambiente digital é completamente imune a riscos, por isso as medidas são revisadas continuamente.",
    ],
  },
  {
    titulo: "Retenção e eliminação",
    paragrafos: [
      "Mantemos os dados pelo tempo necessário à prestação do serviço, proteção contra fraudes, defesa de direitos e cumprimento de obrigações legais. Pedidos de exclusão podem preservar registros cuja manutenção seja obrigatória ou necessária para comprovação de transações.",
    ],
  },
  {
    titulo: "Seus direitos",
    itens: [
      "Confirmar a existência de tratamento e solicitar acesso ou correção dos seus dados.",
      "Solicitar informação sobre compartilhamentos, portabilidade quando aplicável e revisão de dados incorretos.",
      "Solicitar anonimização, bloqueio ou eliminação quando cabível, respeitadas as obrigações legais.",
      "Revogar consentimento para tratamentos que dependam dessa base, sem afetar operações realizadas anteriormente.",
    ],
  },
  {
    titulo: "Contato e atualizações",
    paragrafos: [
      "Solicitações relacionadas à privacidade podem ser encaminhadas ao suporte. Esta política poderá ser atualizada para refletir mudanças legais, técnicas ou operacionais, com indicação da data da versão vigente.",
    ],
  },
];

export default function PrivacidadePage() {
  return (
    <FotosLegalPage
      etiqueta="Proteção de dados"
      titulo="Privacidade"
      introducao="Esta política explica como o Itatame Fotos utiliza e protege dados pessoais na operação de galerias, compras, pagamentos, downloads e busca facial, em conformidade com os princípios da legislação brasileira de proteção de dados."
      secoes={secoes}
    />
  );
}
