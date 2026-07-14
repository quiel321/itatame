import type { Metadata } from "next";
import FotosLegalPage from "../_components/FotosLegalPage";

export const metadata: Metadata = {
  title: "Termos de Uso | Itatame Fotos",
  description: "Condições de utilização da plataforma Itatame Fotos.",
};

const secoes = [
  {
    titulo: "Aceitação e finalidade",
    paragrafos: [
      "Ao acessar ou utilizar o Itatame Fotos, você declara que leu e concorda com estes termos. A plataforma conecta compradores, fotógrafos e organizadores para publicação, localização, comercialização e entrega de conteúdos de eventos.",
    ],
  },
  {
    titulo: "Contas e responsabilidades",
    itens: [
      "Cada usuário deve fornecer informações verdadeiras, manter suas credenciais protegidas e comunicar qualquer acesso indevido.",
      "Fotógrafos e organizadores respondem pela autoria, autorização de publicação e regularidade dos conteúdos enviados.",
      "O comprador deve utilizar os arquivos adquiridos de acordo com a licença e a finalidade informadas na oferta.",
    ],
  },
  {
    titulo: "Galerias, imagens e propriedade intelectual",
    paragrafos: [
      "Os direitos autorais permanecem com seus respectivos titulares. O envio de conteúdo concede ao Itatame Fotos autorização técnica para armazenar, processar, gerar prévias, aplicar proteções, exibir e entregar o arquivo conforme necessário à operação da plataforma.",
      "É proibido enviar conteúdo ilícito, sem autorização, ofensivo ou que viole direitos de terceiros. Materiais denunciados poderão ser restringidos durante a análise.",
    ],
  },
  {
    titulo: "Preços, taxas e repasses",
    itens: [
      "A comissão do Itatame Fotos é apresentada antes da utilização comercial e incide conforme as condições publicadas na página de preços.",
      "Tarifas financeiras, prazos e meios de pagamento dependem da instituição de pagamento e podem ser descontados separadamente.",
      "Quando houver royalty de organizador, o percentual deverá ser informado ao fotógrafo e registrado nas vendas aplicáveis.",
      "Reembolsos, contestações e estornos podem gerar ajustes nos saldos e repasses das partes envolvidas.",
    ],
  },
  {
    titulo: "Busca facial e proteção das prévias",
    paragrafos: [
      "A busca facial é uma ferramenta de conveniência e pode apresentar resultados aproximados, incompletos ou sem correspondência. O usuário deve confirmar visualmente as fotos antes da compra.",
      "Marcas-d’água e proteções de visualização reduzem usos indevidos, mas não constituem garantia absoluta contra capturas ou reproduções externas.",
    ],
  },
  {
    titulo: "Disponibilidade e uso adequado",
    paragrafos: [
      "Podemos realizar atualizações, manutenções e medidas de segurança. É proibido tentar contornar permissões, automatizar acessos abusivos, explorar falhas, interferir no serviço ou acessar dados de terceiros.",
    ],
  },
  {
    titulo: "Suspensão, alterações e contato",
    paragrafos: [
      "Contas e conteúdos podem ser limitados ou suspensos em caso de fraude, risco à segurança, violação destes termos ou obrigação legal. Estes termos poderão ser atualizados para acompanhar mudanças operacionais ou legais, com publicação da nova versão nesta página.",
    ],
  },
];

export default function TermosDeUsoPage() {
  return (
    <FotosLegalPage
      etiqueta="Regras da plataforma"
      titulo="Termos de Uso"
      introducao="Estas condições organizam a relação entre o Itatame Fotos, compradores, fotógrafos e organizadores. Elas explicam responsabilidades, pagamentos, uso das imagens e funcionamento dos recursos da plataforma."
      secoes={secoes}
    />
  );
}
