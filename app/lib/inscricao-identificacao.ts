export type AtletaResponsavel = {
  id: string | number; user_id: string | null; responsavel_id?: string | null;
  nome?: string | null; nascimento?: string | null; telefone?: string | null; email?: string | null;
};
export type IdentidadeInscricao = {
  atleta_id?: string | number | null; user_id?: string | null; idade?: string | number | null;
  responsavel_nome?: string; responsavel_contato?: string;
};

export function idadeCivil(nascimento?: string | null, agora = new Date()) {
  const iso = String(nascimento || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [ano, mes, dia] = iso.split('-').map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  if (data.getUTCFullYear() !== ano || data.getUTCMonth() + 1 !== mes || data.getUTCDate() !== dia) return null;
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Cuiaba', year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora);
  const [anoHoje, mesHoje, diaHoje] = hoje.split('-').map(Number);
  const idade = anoHoje - ano - (mesHoje < mes || (mesHoje === mes && diaHoje < dia) ? 1 : 0);
  return idade >= 0 && idade <= 120 ? idade : null;
}

export function dataHoraInscricao(valor?: string | null) {
  if (!valor) return 'Não registrada';
  const data = new Date(valor);
  if (!Number.isFinite(data.getTime())) return 'Não registrada';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Cuiaba', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).format(data);
}

export function identificarResponsavel(item: IdentidadeInscricao, atleta?: AtletaResponsavel, responsavel?: AtletaResponsavel, agora = new Date()) {
  const idade = idadeCivil(atleta?.nascimento, agora);
  const idadeInformada = item.idade === null || item.idade === undefined || item.idade === '' ? null : Number(item.idade);
  const menor = idade !== null ? idade < 18 : idadeInformada !== null && Number.isFinite(idadeInformada) && idadeInformada >= 0 && idadeInformada < 18;
  if (!atleta?.responsavel_id) return { responsavel_nome: menor ? 'Não informado (menor)' : '—', responsavel_contato: '' };
  if (!responsavel || responsavel.user_id !== atleta.responsavel_id) return { responsavel_nome: 'Responsável não localizado', responsavel_contato: '' };
  const idadeAdulto = idadeCivil(responsavel.nascimento, agora);
  const observacao = idadeAdulto === null ? ' · idade não informada' : idadeAdulto < 18 ? ' · conferir: menor de 18 anos' : '';
  return {
    responsavel_nome: (responsavel.nome?.trim() || 'Nome do responsável não informado') + observacao,
    responsavel_contato: [responsavel.telefone, responsavel.email].filter(Boolean).join(' · '),
  };
}
