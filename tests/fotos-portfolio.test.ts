import test from 'node:test';
import assert from 'node:assert/strict';
import { carregarPortfolioOrganizador } from '../app/lib/fotos-portfolio-servidor';
import { filtrarGaleriasPortfolio, type GaleriaPortfolio } from '../app/lib/fotos-portfolio';

test('portfólio filtra com acentos, cidade, ano e categoria sem alterar a lista', () => {
  const lista: GaleriaPortfolio[] = [{ id: 'a', nome: '3º Campeonato Interno Spartan', categoria: 'jiu-jitsu', cidade: 'Campos de Júlio', estado: 'MT', local: null, data_evento: '2026-10-17', capa_url: null, em_breve: false, vendas_ate: null, quantidade: 1228 }, { id: 'b', nome: 'Corrida', categoria: 'corrida', cidade: 'Cuiabá', estado: 'MT', local: null, data_evento: '2025-09-17', capa_url: null, em_breve: false, vendas_ate: null, quantidade: 20 }];
  const antes = structuredClone(lista), padrao = { busca: '', cidade: '', categoria: '', ano: '' };
  assert.equal(filtrarGaleriasPortfolio(lista, { ...padrao, busca: 'JULIO' })[0].id, 'a');
  assert.equal(filtrarGaleriasPortfolio(lista, { ...padrao, cidade: 'Cuiabá', ano: '2025' })[0].id, 'b');
  assert.equal(filtrarGaleriasPortfolio(lista, { ...padrao, categoria: 'corrida' }).length, 1);
  assert.equal(filtrarGaleriasPortfolio(lista, { ...padrao, cidade: 'Cuiabá', ano: '2026' }).length, 0);
  assert.deepEqual(lista, antes);
});

test('carregamento público não expõe contatos privados, galerias por link ou arquivos originais', async () => {
  const fetchAntes = globalThis.fetch;
  const envAntes = [process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY];
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fixture.supabase.co'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'ficticia';
  let chamadas = 0;
  globalThis.fetch = async (input, init) => {
    chamadas++;
    const u = new URL(String(input)); assert.equal(init?.method || 'GET', 'GET'); assert.equal(u.hostname, 'fixture.supabase.co');
    const colunas = u.searchParams.get('select') || '';
    assert.ok(!/email|telefone|documento|access_token|r2_original_key|acesso_token/.test(colunas));
    if (u.pathname === '/rest/v1/foto_organizadores') return Response.json({ id: 'org', nome: 'Organizador', slug: 'organizador', localizacao: 'Brasil', avatar_url: null, capa_url: null, sigla: null });
    assert.equal(u.pathname, '/rest/v1/foto_eventos'); assert.equal(u.searchParams.get('organizador_user_id'), 'eq.org'); assert.equal(u.searchParams.get('status'), 'eq.publicado');
    assert.equal(u.searchParams.get('or'), '(acesso_por_link.eq.false,acesso_por_link.is.null)'); assert.equal(u.searchParams.get('foto_arquivos.status'), 'eq.publicada');
    return Response.json([{ id: 'galeria', nome: 'Galeria pública', foto_arquivos: [{ count: 35 }] }]);
  };
  try {
    assert.equal(await carregarPortfolioOrganizador('../privado'), null); assert.equal(chamadas, 0);
    const resultado = await carregarPortfolioOrganizador('organizador'); assert.equal(resultado?.galerias[0].quantidade, 35); assert.equal(chamadas, 2);
    assert.ok(!JSON.stringify(resultado).includes('foto_arquivos'));
  } finally { globalThis.fetch = fetchAntes; ['NEXT_PUBLIC_SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'].forEach((n, i) => { if (envAntes[i] === undefined) delete process.env[n]; else process.env[n] = envAntes[i]; }); }
});
