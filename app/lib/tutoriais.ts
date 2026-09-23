export type Tutorial = {
  numero: string;
  titulo: string;
  resumo: string;
  capa: string;
  url: string;
};

export const canalItatame = "https://www.youtube.com/@itatameSistemas";

export const tutoriais: Tutorial[] = [
  {
    numero: "01",
    titulo: "Como criar uma conta de professor",
    resumo: "Crie sua conta, escolha o perfil de professor e prepare o acesso à área de equipe.",
    capa: "/tutoriais/01-professor.jpg",
    url: "https://www.youtube.com/watch?v=xgiaVraFsgA",
  },
  {
    numero: "02",
    titulo: "Como criar uma conta de atleta",
    resumo: "Faça seu cadastro de atleta e complete o perfil para participar dos campeonatos.",
    capa: "/tutoriais/02-atleta.jpg",
    url: "https://www.youtube.com/watch?v=AmSuYRjYVg0",
  },
  {
    numero: "03",
    titulo: "Como cadastrar um atleta menor",
    resumo: "Adicione um dependente pela conta do responsável e deixe os dados prontos para a inscrição.",
    capa: "/tutoriais/03-atleta-menor.jpg",
    url: "https://www.youtube.com/watch?v=9eNBJQ9sNw8",
  },
  {
    numero: "04",
    titulo: "Como cadastrar equipe e academia",
    resumo: "Vincule sua equipe e academia ao campeonato pela área de professor.",
    capa: "/tutoriais/04-equipe-academia.jpg",
    url: "https://www.youtube.com/watch?v=ZAECdO5ihpM",
  },
  {
    numero: "05",
    titulo: "Como inscrever atleta ou menor",
    resumo: "Escolha o campeonato e conclua a inscrição do atleta ou dependente.",
    capa: "/tutoriais/05-inscricao.jpg",
    url: "https://www.youtube.com/watch?v=uyfCxeVsURo",
  },
];
