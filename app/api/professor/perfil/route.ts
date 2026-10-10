import { NextResponse } from 'next/server';
import { autenticarRequest } from '@/app/lib/api-auth';
import { createSupabaseServerClient } from '@/app/lib/supabase-server';
import { academiaPreenchida, equipePreenchida } from '@/app/lib/alunos-sugeridos';
import { cpfValido, formatarCpf } from '@/app/lib/validar-cpf';
import { validarNascimentoTitular } from '@/app/lib/idade-cadastro';

export async function PATCH(request: Request) {
  const usuario = await autenticarRequest(request);
  if (!usuario || usuario.is_anonymous) return NextResponse.json({ error: 'Entre na sua conta de professor.' }, { status: 401 });
  const db = createSupabaseServerClient();
  const { data: perfil, error: erroPerfil } = await db.from('atletas').select('role').eq('user_id', usuario.id).maybeSingle();
  if (erroPerfil) return NextResponse.json({ error: 'Não foi possível conferir o perfil.' }, { status: 500 });
  if (perfil?.role !== 'professor') return NextResponse.json({ error: 'Este recurso é exclusivo para professores.' }, { status: 403 });
  const body = await request.json().catch(() => null);
  const texto = (campo: string) => typeof body?.[campo] === 'string' ? body[campo].trim() : '';
  const nome = texto('nome');
  const equipe = texto('equipe');
  const academia = texto('academia');
  if (!nome || !equipePreenchida(equipe) || !academiaPreenchida(academia)) return NextResponse.json({ error: 'Nome, equipe e academia / CT são obrigatórios para salvar o professor.' }, { status: 400 });
  if (!cpfValido(texto('cpf'))) return NextResponse.json({ error: 'Informe um CPF válido.' }, { status: 400 });
  const telefone = texto('telefone').replace(/\D/g, '');
  if (telefone && ![10, 11].includes(telefone.length)) return NextResponse.json({ error: 'Informe um telefone válido com DDD.' }, { status: 400 });
  const nascimento = texto('nascimento');
  if (nascimento && !validarNascimentoTitular(nascimento).ok) return NextResponse.json({ error: 'Informe uma data de nascimento válida para o titular adulto.' }, { status: 400 });
  const peso = body?.peso === null || body?.peso === undefined || body?.peso === '' ? null : Number(body.peso);
  if (peso !== null && (!Number.isFinite(peso) || peso < 0)) return NextResponse.json({ error: 'Informe um peso válido.' }, { status: 400 });
  const { data: salvo, error } = await db.from('atletas').update({
    nome, equipe, academia, cpf: formatarCpf(texto('cpf')), telefone,
    cidade: texto('cidade'), faixa: texto('faixa'), modalidade: texto('modalidade'), sexo: texto('sexo'),
    nascimento: nascimento || null, peso, foto_url: texto('foto_url'),
  }).eq('user_id', usuario.id).eq('role', 'professor').select('id').maybeSingle();
  if (error) return NextResponse.json({ error: error.code === '23505' ? 'CPF, telefone ou e-mail já cadastrado.' : 'Não foi possível salvar o professor.' }, { status: 400 });
  if (!salvo) return NextResponse.json({ error: 'O perfil mudou. Atualize a página e tente novamente.' }, { status: 409 });
  return NextResponse.json({ success: true });
}
