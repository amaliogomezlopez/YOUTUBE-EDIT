import assert from 'node:assert/strict';
import {mkdtemp, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  searchBrandfetch,
  searchEditorialAssets,
  searchPexels
} from '../src/lib/editorial-asset-search.js';

async function catalogFixture(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'asset-search-'));
  t.after(async () => {
    const {rm} = await import('node:fs/promises');
    await rm(directory, {recursive: true, force: true});
  });
  const file = path.join(directory, 'images.json');
  await writeFile(file, JSON.stringify({
    version: 1,
    images: [
      {
        id: 'finance-cavaliers-nvidia',
        publicPath: 'assets/library/logos/nvidia.png',
        alt: 'Logotipo de NVIDIA',
        width: 80,
        height: 80,
        source: 'https://simpleicons.org/',
        author: 'Simple Icons',
        license: 'CC0; trademark retained',
        tags: ['empresa', 'tecnología', 'nvidia'],
        assetType: 'logo'
      }
    ]
  }), 'utf8');
  return file;
}

test('asset search returns matching managed logos without network keys', async (t) => {
  const result = await searchEditorialAssets({
    query: 'NVIDIA',
    kind: 'logo'
  }, {
    catalogFile: await catalogFixture(t),
    env: {}
  });
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].provider, 'local');
  assert.equal(result.items[0].imported, true);
  assert.equal(result.warnings[0].code, 'BRANDFETCH_NOT_CONFIGURED');
});

test('Pexels photo search maps only HTTPS provenance fields', async () => {
  const result = await searchPexels('mercados', {
    kind: 'image',
    apiKey: 'test-key',
    fetchImpl: async () => new Response(JSON.stringify({
      photos: [{
        id: 42,
        width: 1920,
        height: 1080,
        url: 'https://www.pexels.com/photo/42/',
        photographer: 'Autora',
        alt: 'Pantalla financiera',
        src: {
          medium: 'https://images.pexels.com/photos/42/medium.jpg',
          original: 'https://images.pexels.com/photos/42/original.jpg'
        }
      }]
    }), {status: 200})
  });
  assert.equal(result[0].provider, 'pexels');
  assert.equal(result[0].license, 'Pexels License');
  assert.equal(result[0].author, 'Autora');
  assert.match(result[0].downloadUrl, /^https:/);
});

test('Brandfetch search preserves domain and claimed status', async () => {
  const result = await searchBrandfetch('NVIDIA', {
    clientId: 'client-test',
    fetchImpl: async () => new Response(JSON.stringify([{
      icon: 'https://cdn.brandfetch.io/nvidia.svg',
      name: 'NVIDIA',
      domain: 'nvidia.com',
      claimed: true,
      brandId: 'brand-nvidia'
    }]), {status: 200})
  });
  assert.equal(result[0].kind, 'logo');
  assert.equal(result[0].domain, 'nvidia.com');
  assert.equal(result[0].claimed, true);
  assert.equal('clientId' in result[0], false);
});

test('asset search rejects unsupported kinds before fetching', async (t) => {
  await assert.rejects(
    searchEditorialAssets({
      query: 'mercados',
      kind: 'audio'
    }, {
      catalogFile: await catalogFixture(t),
      env: {}
    }),
    /Tipo de asset no válido/
  );
});
