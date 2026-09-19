import { chavesDaInscricao, idadeCompetitiva, type CategoriaCompeticao, type ChaveChecagem } from './categorias-competicao';
import { nomeEquipeChecagem } from './equipes-nome';

export type EquipeChecagem = {
  id: string;
  nome: string;
  academia: string | null;
  professor: string | null;
  cidade?: string | null;
  logo_url?: string | null;
  academia_logo_url?: string | null;
};

export type AcademiaChecagem = {
  id: string;
  equipe_id?: string | null;
  academia?: string | null;
  professor?: string | null;
  logo_url?: string | null;
};

export type InscritoChecagem = {
  id: string;
  numero: string;
  atleta_nome: string;
  equipe: string;
  equipe_id?: string | null;
  academia: string;
  professor: string;
  faixa: string;
  peso: string;
  sexo: string;
  pagamento_ok: boolean;
  absoluto: boolean;
  sozinho: boolean;
  logo_url?: string | null;
  academia_logo_url?: string | null;
  chaves: ChaveChecagem[];
  categoria_rotulo: string;
};

export type AbaChecagem = 'geral' | 'absoluto' | 'peso' | 'equipe' | 'professor';

export function chaveProfessor(professor?: string | null, academia?: string | null, equipe?: string | null) {
  const nome = String(professor || '').trim() || 'Sem professor';
  const origem = String(academia || equipe || '').trim();
  return origem ? `${origem} — ${nome}` : nome;
}

export function letraAtleta(nome: string) {
  const letra = String(nome || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').charAt(0).toUpperCase();
  return /[A-Z]/.test(letra) ? letra : '#';
}

function idadeDaInscricao(insc: Record<string, unknown>, atleta: Record<string, unknown> | undefined, dataEvento?: string | null) {
  const direto = Number(insc.idade);
  if (insc.idade !== '' && insc.idade != null && Number.isInteger(direto)) return direto;
  const nascimento = atleta?.nascimento ? String(atleta.nascimento) : null;
  const calculada = idadeCompetitiva(nascimento, dataEvento);
  return Number.isInteger(calculada) ? calculada : insc.idade;
}

function chaveAbsolutoInscrito(sexo: string): ChaveChecagem {
  const sexoLimpo = sexo.trim();
  return {
    tipo: 'absoluto',
    chave: `abs:inscrito:${sexoLimpo.toLowerCase() || 'sem-sexo'}`,
    rotulo: sexoLimpo ? `Absoluto · ${sexoLimpo}` : 'Absoluto',
  };
}

export function montarInscritosChecagem(
  inscricoes: Array<Record<string, unknown>>,
  atletas: Array<Record<string, unknown>>,
  categorias: CategoriaCompeticao[],
  equipes: EquipeChecagem[],
  academias: AcademiaChecagem[] = [],
  dataEvento?: string | null,
): InscritoChecagem[] {
  const porUser = new Map(atletas.map((atleta) => [String(atleta.user_id || ''), atleta]));
  const logoPorEquipe = new Map(equipes.map((equipe) => [equipe.id, equipe.logo_url || null]));
  const logoPorNome = new Map(equipes.map((equipe) => [equipe.nome.trim().toUpperCase(), equipe.logo_url || null]));
  const logoAcademiaPadrao = new Map(equipes.map((equipe) => [equipe.id, equipe.academia_logo_url || null]));
  const logoAcademiaUnidade = academias.map((item) => ({
    academia: String(item.academia || '').trim().toLowerCase(),
    professor: String(item.professor || '').trim().toLowerCase(),
    equipeId: String(item.equipe_id || ''),
    logo: item.logo_url || null,
  }));
  const ordenadas = [...inscricoes].sort((a, b) => {
    const dataA = String(a.created_at || a.id || '');
    const dataB = String(b.created_at || b.id || '');
    return dataA.localeCompare(dataB);
  });

  const dados = ordenadas.map((insc, indice) => {
    const atl = porUser.get(String(insc.user_id || ''));
    const faixa = String(insc.faixa || atl?.faixa || 'FAIXA NÃO INFORMADA');
    const sexo = String(insc.sexo || atl?.sexo || '');
    const chaves = chavesDaInscricao({
      ...insc,
      faixa,
      sexo,
      peso: String(insc.peso || atl?.peso || ''),
      idade: idadeDaInscricao(insc, atl, dataEvento),
      modalidade: insc.modalidade || atl?.modalidade || null,
    }, categorias);
    if (Boolean(insc.absoluto) && !chaves.some((chave) => chave.tipo === 'absoluto')) {
      chaves.push(chaveAbsolutoInscrito(sexo));
    }
    const principal = chaves[0];
    const equipe = nomeEquipeChecagem(
      { equipe: String(insc.equipe || ''), equipe_id: insc.equipe_id ? String(insc.equipe_id) : null },
      equipes,
      String(atl?.equipe || ''),
    );
    const oficial = equipes.find((item) => item.nome === equipe) || equipes.find((item) => item.id === String(insc.equipe_id || ''));
    const academia = String(atl?.academia || oficial?.academia || '');
    const professor = String(atl?.professor || oficial?.professor || 'Sem professor');
    const unidade = logoAcademiaUnidade.find((item) =>
      item.equipeId === String(oficial?.id || insc.equipe_id || '')
      && (!item.academia || item.academia === academia.trim().toLowerCase())
      && (!item.professor || item.professor === professor.trim().toLowerCase()),
    );
    return {
      id: String(insc.id),
      numero: String(indice + 1).padStart(4, '0'),
      atleta_nome: String(insc.atleta || atl?.nome || 'Atleta desconhecido'),
      equipe,
      equipe_id: insc.equipe_id ? String(insc.equipe_id) : oficial?.id || null,
      academia,
      professor,
      faixa,
      peso: String(insc.peso || ''),
      sexo,
      pagamento_ok: Boolean(insc.pagamento_ok),
      absoluto: Boolean(insc.absoluto) || chaves.some((chave) => chave.tipo === 'absoluto'),
      sozinho: false,
      logo_url: (insc.equipe_id ? logoPorEquipe.get(String(insc.equipe_id)) : null) || logoPorNome.get(equipe.trim().toUpperCase()) || null,
      academia_logo_url: unidade?.logo || (oficial ? logoAcademiaPadrao.get(oficial.id) : null) || null,
      chaves,
      categoria_rotulo: principal?.rotulo || String(insc.categoria || 'Sem categoria do organizador'),
    } satisfies InscritoChecagem;
  });

  const totais = dados.reduce((acc, insc) => {
    for (const chave of insc.chaves) acc[chave.chave] = (acc[chave.chave] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  dados.forEach((insc) => { insc.sozinho = insc.chaves.some((chave) => totais[chave.chave] === 1); });
  dados.sort((a, b) => a.atleta_nome.localeCompare(b.atleta_nome, 'pt-BR'));
  return dados;
}
