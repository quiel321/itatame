import { supabase } from './supabase';
import { MAX_UPLOAD_PUBLICO, type TipoMidiaPublica, type EscopoMidiaPublica } from './midia-publica';

export async function enviarMidiaPublica(file: File, tipo: TipoMidiaPublica, escopo: EscopoMidiaPublica = 'itatame') {
  if (file.size > MAX_UPLOAD_PUBLICO) throw new Error('O arquivo precisa ter até 4 MB.');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Sessão expirada. Entre novamente.');
  const form = new FormData();
  form.set('file', file);
  form.set('tipo', tipo);
  form.set('escopo', escopo);
  const resposta = await fetch('/api/midia-publica/upload', {
    method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` }, body: form,
  });
  const dados = await resposta.json().catch(() => null);
  if (!resposta.ok || !dados?.publicUrl) throw new Error(dados?.error || 'Não foi possível enviar o arquivo.');
  return dados.publicUrl as string;
}
