import { supabase } from './supabase';

export type SessaoStaff = {
  id: string;
  evento_id: string;
  funcao: string;
  identificacao: string;
  evento_nome?: string;
  user_id?: string;
  pin?: string;
};

const CHAVE_SESSAO = 'itatame_staff_session';

export function lerSessaoStaff(): SessaoStaff | null {
  try {
    const bruto = localStorage.getItem(CHAVE_SESSAO);
    return bruto ? (JSON.parse(bruto) as SessaoStaff) : null;
  } catch {
    localStorage.removeItem(CHAVE_SESSAO);
    return null;
  }
}

// O banco só reconhece o posto enquanto o PIN estiver vinculado a esta sessao anonima, e o vinculo
// expira em 24h. Rechamar antes de gravar cobre plantao longo, aba aberta de um dia para o outro e
// sessao criada antes deste ajuste (que nao guardou o PIN).
export async function garantirVinculoStaff(): Promise<{ ok: boolean; erro?: string }> {
  const sessao = lerSessaoStaff();
  if (!sessao?.pin) {
    return { ok: false, erro: 'Sessão do posto desatualizada. Saia e entre novamente com o PIN.' };
  }
  const { error } = await supabase.rpc('vincular_sessao_staff', { p_pin: sessao.pin });
  if (error) {
    return { ok: false, erro: `Posto sem autorização no banco: ${error.message}` };
  }
  return { ok: true };
}
