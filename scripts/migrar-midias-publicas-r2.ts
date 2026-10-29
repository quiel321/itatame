import { loadEnvConfig } from '@next/env';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createSupabaseServerClient } from '../app/lib/supabase-server';
import { origemPublicaSupabase, type EscopoMidiaPublica, type TipoMidiaPublica } from '../app/lib/midia-publica';
import { enderecoMidiaPublica, salvarMidiaPublica } from '../app/lib/midia-publica-servidor';
import { getR2ObjectBytes, r2Config } from '../app/lib/r2';

loadEnvConfig(process.cwd());

const alvos: { tabela: string; coluna: string; tipo: TipoMidiaPublica; escopo: EscopoMidiaPublica }[] = [
  { tabela: 'eventos', coluna: 'banner_url', tipo: 'banner', escopo: 'itatame' },
  { tabela: 'eventos', coluna: 'regulamento_url', tipo: 'documento', escopo: 'itatame' },
  { tabela: 'eventos', coluna: 'tabela_peso_pdf_url', tipo: 'documento', escopo: 'itatame' },
  { tabela: 'atletas', coluna: 'foto_url', tipo: 'avatar', escopo: 'itatame' },
  { tabela: 'organizadores', coluna: 'foto_url', tipo: 'avatar', escopo: 'itatame' },
  { tabela: 'equipes_evento', coluna: 'logo_url', tipo: 'avatar', escopo: 'itatame' },
  { tabela: 'equipes_evento', coluna: 'academia_logo_url', tipo: 'avatar', escopo: 'itatame' },
  { tabela: 'solicitacoes_equipe_evento', coluna: 'logo_url', tipo: 'avatar', escopo: 'itatame' },
  { tabela: 'fotografos', coluna: 'foto_url', tipo: 'avatar', escopo: 'retratt' },
  { tabela: 'foto_organizadores', coluna: 'avatar_url', tipo: 'avatar', escopo: 'retratt' },
  { tabela: 'foto_organizadores', coluna: 'capa_url', tipo: 'capa', escopo: 'retratt' },
  { tabela: 'foto_eventos', coluna: 'capa_url', tipo: 'capa', escopo: 'retratt' },
  { tabela: 'foto_albuns', coluna: 'capa_url', tipo: 'capa', escopo: 'retratt' },
];
type Item = typeof alvos[number] & { id: string; anterior: string; nova?: string; key?: string; bytesAntes?: number; bytesDepois?: number; aplicada?: boolean };
type Plano = { versao: 1; projeto: string; criadoEm: string; itens: Item[] };
const arg = (nome: string) => process.argv.find(a => a.startsWith(`--${nome}=`))?.slice(nome.length + 3);
const modo = process.argv.includes('--copiar') ? 'copiar' : process.argv.includes('--aplicar') ? 'aplicar' : process.argv.includes('--reverter') ? 'reverter' : 'inventario';
const arquivo = resolve(arg('plano') || 'output/midia-publica-r2/plano.json');
const filtro = arg('escopo');
const db = createSupabaseServerClient();
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

async function salvar(plano: Plano) {
  await mkdir(dirname(arquivo), { recursive: true });
  await writeFile(arquivo, JSON.stringify(plano, null, 2) + '\n', { mode: 0o600 });
}

async function inventario(): Promise<Plano> {
  const itens: Item[] = [];
  for (const alvo of alvos.filter(a => !filtro || a.escopo === filtro)) {
    for (let inicio = 0; ; inicio += 500) {
      const { data, error } = await db.from(alvo.tabela).select(`id,${alvo.coluna}`)
        .not(alvo.coluna, 'is', null).order('id').range(inicio, inicio + 499);
      if (error) throw new Error(`${alvo.tabela}.${alvo.coluna}: ${error.message}`);
      for (const linha of (data || []) as unknown as Record<string, unknown>[]) {
        const anterior = String(linha[alvo.coluna] || '');
        if (origemPublicaSupabase(anterior, supabaseUrl)) itens.push({ ...alvo, id: String(linha.id), anterior });
      }
      if (!data || data.length < 500) break;
    }
  }
  return { versao: 1, projeto: new URL(supabaseUrl).hostname, criadoEm: new Date().toISOString(), itens };
}

async function main() {
  if (filtro && !['itatame', 'retratt'].includes(filtro)) throw new Error('--escopo deve ser itatame ou retratt.');
  if (modo === 'inventario') {
    const plano = await inventario();
    for (const escopo of ['itatame', 'retratt']) console.log(`${escopo}: ${plano.itens.filter(i => i.escopo === escopo).length} referência(s) no Supabase.`);
    console.log('Inventário somente. --copiar gera e verifica as cópias sem alterar os links do banco.');
    return;
  }
  let plano: Plano;
  try { plano = JSON.parse(await readFile(arquivo, 'utf8')); }
  catch (erro) {
    if (modo !== 'copiar' || (erro as NodeJS.ErrnoException).code !== 'ENOENT') throw erro;
    plano = await inventario();
    await salvar(plano);
  }
  if (plano.versao !== 1 || plano.projeto !== new URL(supabaseUrl).hostname) throw new Error('Plano pertence a outro projeto ou versão.');
  const selecionados = plano.itens.filter(i => !filtro || i.escopo === filtro);
  const destinos = new Map<EscopoMidiaPublica, string>();
  for (const item of selecionados) {
    if (!alvos.some(a => a.tabela === item.tabela && a.coluna === item.coluna && a.escopo === item.escopo && a.tipo === item.tipo)
      || !origemPublicaSupabase(item.anterior, supabaseUrl)) throw new Error('Referência não permitida no plano.');
    destinos.set(item.escopo, r2Config(item.escopo).bucket);
  }
  if (destinos.size === 2 && destinos.get('itatame') === destinos.get('retratt')) throw new Error('Os buckets precisam ser distintos.');

  if (modo === 'copiar') {
    const { data: buckets, error } = await db.storage.listBuckets();
    if (error) throw error;
    const publicos = new Set(buckets.filter(b => b.public).map(b => b.id));
    const copias = new Map<string, Awaited<ReturnType<typeof salvarMidiaPublica>> & { bytesOrigem: number }>();
    for (const item of selecionados) {
      if (item.nova) continue;
      const origem = origemPublicaSupabase(item.anterior, supabaseUrl)!;
      if (!publicos.has(origem.bucket)) throw new Error('A origem não é um bucket público.');
      const identidade = `${item.escopo}:${item.tipo}:${item.anterior}`;
      let midia = copias.get(identidade);
      if (!midia) {
        const resposta = await fetch(item.anterior, { redirect: 'error', signal: AbortSignal.timeout(30000) });
        if (!resposta.ok) throw new Error(`Origem indisponível (${resposta.status}).`);
        if (Number(resposta.headers.get('content-length')) > 20 * 1024 * 1024) throw new Error('Origem excede 20 MB.');
        const bytes = Buffer.from(await resposta.arrayBuffer());
        midia = { ...await salvarMidiaPublica(bytes, item.tipo, item.escopo), bytesOrigem: bytes.length };
        const conferir = await getR2ObjectBytes(midia.key, 20 * 1024 * 1024, item.escopo);
        if (hash(conferir) !== hash(midia.bytes)) throw new Error('Cópia diverge do arquivo preparado.');
        copias.set(identidade, midia);
      }
      Object.assign(item, { nova: midia.publicUrl, key: midia.key, bytesAntes: midia.bytesOrigem, bytesDepois: midia.bytes.length });
      await salvar(plano);
    }
    console.log(`Cópias verificadas: ${selecionados.filter(i => i.nova).length}. Links do banco preservados.`);
  } else {
    // Verifica TODOS os links de destino antes de alterar o primeiro registro.
    if (modo === 'aplicar') for (const item of selecionados) {
      const nova = item.nova;
      if (!nova) throw new Error('Execute --copiar primeiro.');
      const url = new URL(nova);
      if (nova !== enderecoMidiaPublica(url.pathname.split('/').pop()!, item.escopo)) throw new Error('Destino não permitido.');
      const resposta = await fetch(nova, { redirect: 'error', signal: AbortSignal.timeout(20000) });
      const bytes = Buffer.from(await resposta.arrayBuffer());
      if (!resposta.ok || hash(bytes) !== url.pathname.split('/').pop()!.split('.')[0]
        || !resposta.headers.get('cache-control')?.includes('immutable')) throw new Error('Publicação ainda não está pronta: leitura ou cache do destino falhou. Nenhum link foi alterado.');
    }
    for (const item of selecionados) {
      if (!item.nova) throw new Error('Cópia ausente.');
      const de = modo === 'aplicar' ? item.anterior : item.nova;
      const para = modo === 'aplicar' ? item.nova : item.anterior;
      const { data, error } = await db.from(item.tabela).update({ [item.coluna]: para })
        .eq('id', item.id).eq(item.coluna, de).select('id');
      if (error) throw error;
      if (data?.length) { item.aplicada = modo === 'aplicar'; await salvar(plano); }
    }
    console.log(`Operação ${modo} concluída. Alterações concorrentes foram preservadas.`);
  }
  console.log(`Plano e retorno: ${arquivo}`);
  const antes = selecionados.reduce((n, i) => n + (i.bytesAntes || 0), 0);
  const depois = selecionados.reduce((n, i) => n + (i.bytesDepois || 0), 0);
  console.log(JSON.stringify({ referencias: selecionados.length, bytesAntes: antes, bytesDepois: depois }));
}
main().catch(erro => { console.error(erro instanceof Error ? erro.message : 'Falha na migração.'); process.exitCode = 1; });
