import assert from 'node:assert/strict';
import {mkdtemp, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  searchBrandfetch,
  searchEditorialAssets,
  searchOfflineBrandLogos,
  searchPexels,
  searchPixabay
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
  assert.ok(result.items.length >= 2);
  assert.equal(result.items[0].provider, 'local');
  assert.equal(result.items[0].imported, true);
  assert.ok(result.items.some((item) => item.offlinePackage === 'simple-icons'));
  assert.equal(result.warnings[0].code, 'BRANDFETCH_NOT_CONFIGURED');
});

test('offline logo packages cover Microsoft and Amazon without API keys', () => {
  const microsoft = searchOfflineBrandLogos('Microsoft');
  const amazon = searchOfflineBrandLogos('Amazon');
  assert.ok(microsoft.some((item) => item.id.includes('microsoft')));
  assert.ok(amazon.some((item) => item.id.includes('amazon')));
  assert.match(microsoft[0].previewUrl, /^data:image\/svg\+xml/);
  assert.equal(microsoft[0].kind, 'logo');
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

test('Pixabay video search selects an HTTPS landscape rendition with provenance', async () => {
  const result = await searchPixabay('inteligencia artificial', {
    kind: 'video',
    apiKey: 'test-key',
    fetchImpl: async () => new Response(JSON.stringify({
      hits: [{
        id: 73,
        pageURL: 'https://pixabay.com/videos/id-73/',
        tags: 'servidores, tecnología',
        duration: 11,
        user: 'Autora',
        videos: {
          medium: {
            url: 'https://cdn.pixabay.com/video/73_medium.mp4',
            width: 1920,
            height: 1080,
            thumbnail: 'https://cdn.pixabay.com/video/73_medium.jpg'
          },
          tiny: {
            url: 'http://cdn.pixabay.com/video/73_tiny.mp4',
            width: 640,
            height: 360,
            thumbnail: 'http://cdn.pixabay.com/video/73_tiny.jpg'
          }
        }
      }]
    }), {status: 200})
  });
  assert.equal(result[0].provider, 'pixabay');
  assert.equal(result[0].license, 'Pixabay Content License');
  assert.equal(result[0].width, 1920);
  assert.match(result[0].downloadUrl, /^https:/);
  assert.match(result[0].sourceUrl, /^https:/);
});

test('asset search combines healthy providers when another remote provider fails', async (t) => {
  const requests = [];
  const result = await searchEditorialAssets({
    query: 'mercados',
    kind: 'image',
    limit: 6
  }, {
    catalogFile: await catalogFixture(t),
    env: {
      PEXELS_API_KEY: 'pexels-test',
      PIXABAY_API_KEY: 'pixabay-test'
    },
    fetchImpl: async (url) => {
      requests.push(String(url));
      if (String(url).includes('pexels.com')) {
        return new Response('fallo', {status: 503});
      }
      return new Response(JSON.stringify({
        hits: [{
          id: 9,
          pageURL: 'https://pixabay.com/photos/id-9/',
          tags: 'mercados',
          user: 'Autor',
          webformatURL: 'https://cdn.pixabay.com/photo-9_640.jpg',
          largeImageURL: 'https://cdn.pixabay.com/photo-9_1280.jpg',
          imageWidth: 1920,
          imageHeight: 1080
        }]
      }), {status: 200});
    }
  });
  assert.equal(requests.length, 2);
  assert.ok(result.items.some((item) => item.provider === 'pixabay'));
  assert.ok(result.warnings.some((warning) =>
    warning.code === 'PEXELS_SEARCH_FAILED'
  ));
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
