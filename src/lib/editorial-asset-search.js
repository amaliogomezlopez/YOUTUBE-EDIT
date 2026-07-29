import {readFile} from 'node:fs/promises';
import path from 'node:path';
import * as fontAwesomeBrands from '@fortawesome/free-brands-svg-icons';
import * as simpleIcons from 'simple-icons';
import {fetchWithTimeout} from './network.js';
import {ROOT} from './utils.js';

const PEXELS_PHOTO_SEARCH = 'https://api.pexels.com/v1/search';
const PEXELS_VIDEO_SEARCH = 'https://api.pexels.com/v1/videos/search';
const PIXABAY_PHOTO_SEARCH = 'https://pixabay.com/api/';
const PIXABAY_VIDEO_SEARCH = 'https://pixabay.com/api/videos/';
const BRANDFETCH_SEARCH = 'https://api.brandfetch.io/v2/search';
const DEFAULT_CATALOG = path.join(
  ROOT,
  'remotion-animations',
  'catalog',
  'visuals',
  'images.json'
);
const KINDS = new Set(['image', 'video', 'logo']);

function cleanQuery(value) {
  const query = String(value || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  if (query.length < 2) {
    const error = new Error('La búsqueda debe tener al menos dos caracteres.');
    error.code = 'INVALID_ASSET_QUERY';
    error.status = 400;
    throw error;
  }
  return query;
}

function cleanKind(value) {
  const kind = String(value || 'image').toLowerCase();
  if (!KINDS.has(kind)) {
    const error = new Error(`Tipo de asset no válido: ${kind}.`);
    error.code = 'INVALID_ASSET_KIND';
    error.status = 400;
    throw error;
  }
  return kind;
}

function safeHttps(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function interleave(lists) {
  const result = [];
  const longest = Math.max(0, ...lists.map((list) => list.length));
  for (let index = 0; index < longest; index += 1) {
    for (const list of lists) {
      if (list[index]) result.push(list[index]);
    }
  }
  return result;
}

function normalizeBrand(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function svgDataUrl(svg) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function simpleIconItem(icon) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${icon.title}" viewBox="0 0 24 24"><path fill="#${icon.hex}" d="${icon.path}"/></svg>`;
  const dataUrl = svgDataUrl(svg);
  return {
    id: `simple-icons-${icon.slug}`,
    provider: 'Simple Icons · paquete local',
    kind: 'logo',
    title: icon.title,
    previewUrl: dataUrl,
    downloadUrl: dataUrl,
    sourceUrl: safeHttps(icon.source) || 'https://simpleicons.org/',
    author: 'Simple Icons contributors',
    license: 'CC0; trademark rights retained by brand owner',
    attribution: 'Icono de Simple Icons; no implica afiliación con la marca.',
    width: 24,
    height: 24,
    durationSeconds: null,
    imported: false,
    offlinePackage: 'simple-icons'
  };
}

function fontAwesomeItem(icon) {
  const [width, height, , , pathData] = icon.icon;
  const paths = Array.isArray(pathData) ? pathData : [pathData];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${icon.iconName}" viewBox="0 0 ${width} ${height}">${paths.map((datum) => `<path fill="#FFFFFF" d="${datum}"/>`).join('')}</svg>`;
  const dataUrl = svgDataUrl(svg);
  return {
    id: `font-awesome-brands-${icon.iconName}`,
    provider: 'Font Awesome Free Brands · paquete local',
    kind: 'logo',
    title: icon.iconName
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' '),
    previewUrl: dataUrl,
    downloadUrl: dataUrl,
    sourceUrl: `https://fontawesome.com/icons/${icon.iconName}?f=brands&s=solid`,
    author: 'Font Awesome contributors',
    license: 'CC BY 4.0; trademark rights retained by brand owner',
    attribution: 'Icono de Font Awesome Free; no implica afiliación con la marca.',
    width,
    height,
    durationSeconds: null,
    imported: false,
    offlinePackage: '@fortawesome/free-brands-svg-icons'
  };
}

export function searchOfflineBrandLogos(query, {limit = 18} = {}) {
  const wanted = normalizeBrand(cleanQuery(query));
  const simpleMatches = Object.values(simpleIcons)
    .filter((icon) =>
      icon &&
      typeof icon === 'object' &&
      typeof icon.path === 'string' &&
      [icon.title, icon.slug].some((value) =>
        normalizeBrand(value).includes(wanted)
      )
    )
    .map(simpleIconItem);
  const seen = new Set(simpleMatches.map((item) => normalizeBrand(item.title)));
  const fontAwesomeMatches = Object.values(fontAwesomeBrands)
    .filter((icon) =>
      icon &&
      typeof icon === 'object' &&
      Array.isArray(icon.icon) &&
      normalizeBrand(icon.iconName).includes(wanted) &&
      !seen.has(normalizeBrand(icon.iconName))
    )
    .map(fontAwesomeItem);
  return [...simpleMatches, ...fontAwesomeMatches].slice(
    0,
    Math.min(30, Math.max(1, limit))
  );
}

function textMatch(record, query) {
  const haystack = [
    record.id,
    record.alt,
    record.author,
    record.assetType,
    ...(record.tags || [])
  ].join(' ').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const needles = query
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .split(/\s+/);
  return needles.every((needle) => haystack.includes(needle));
}

function localItem(record) {
  return {
    id: record.id,
    provider: 'local',
    kind: record.assetType === 'logo' ? 'logo' : 'image',
    title: record.alt,
    previewUrl: `/${record.publicPath}`,
    downloadUrl: null,
    sourceUrl: safeHttps(record.source),
    author: record.author || null,
    license: record.license,
    attribution: record.attribution || null,
    width: record.width,
    height: record.height,
    durationSeconds: null,
    imported: true
  };
}

export async function searchLocalEditorialAssets(query, {
  kind = 'image',
  limit = 18,
  catalogFile = DEFAULT_CATALOG
} = {}) {
  const wantedKind = cleanKind(kind);
  if (wantedKind === 'video') return [];
  const catalog = JSON.parse(await readFile(catalogFile, 'utf8'));
  return (catalog.images || [])
    .filter((record) =>
      (wantedKind === 'logo'
        ? record.assetType === 'logo'
        : record.assetType !== 'logo') &&
      textMatch(record, cleanQuery(query))
    )
    .slice(0, limit)
    .map(localItem);
}

export async function searchPexels(query, {
  kind = 'image',
  limit = 18,
  apiKey = process.env.PEXELS_API_KEY,
  fetchImpl = globalThis.fetch,
  signal,
  timeoutMs = 20_000
} = {}) {
  const wantedKind = cleanKind(kind);
  if (!['image', 'video'].includes(wantedKind) || !apiKey) return [];
  const endpoint = wantedKind === 'video' ? PEXELS_VIDEO_SEARCH : PEXELS_PHOTO_SEARCH;
  const url = new URL(endpoint);
  url.searchParams.set('query', cleanQuery(query));
  url.searchParams.set('per_page', String(Math.min(30, Math.max(1, limit))));
  url.searchParams.set('orientation', 'landscape');
  const response = await fetchWithTimeout(url, {
    headers: {Authorization: apiKey}
  }, {fetchImpl, signal, timeoutMs});
  if (!response.ok) {
    const error = new Error(`Pexels respondió con HTTP ${response.status}.`);
    error.code = 'PEXELS_SEARCH_FAILED';
    error.status = response.status === 429 ? 429 : 502;
    throw error;
  }
  const payload = await response.json();
  if (wantedKind === 'image') {
    return (payload.photos || []).map((photo) => ({
      id: `pexels-photo-${photo.id}`,
      provider: 'pexels',
      kind: 'image',
      title: photo.alt || `Fotografía de ${photo.photographer || 'Pexels'}`,
      previewUrl: safeHttps(photo.src?.medium || photo.src?.large),
      downloadUrl: safeHttps(photo.src?.original || photo.src?.large2x),
      sourceUrl: safeHttps(photo.url),
      author: photo.photographer || null,
      license: 'Pexels License',
      attribution: photo.photographer
        ? `Foto de ${photo.photographer} en Pexels.`
        : 'Foto de Pexels.',
      width: Number(photo.width) || null,
      height: Number(photo.height) || null,
      durationSeconds: null,
      imported: false
    })).filter((item) => item.previewUrl && item.sourceUrl);
  }
  return (payload.videos || []).map((video) => {
    const files = (video.video_files || [])
      .filter((file) => file.file_type === 'video/mp4' && safeHttps(file.link))
      .sort((left, right) => {
        const leftDistance = Math.abs((left.width || 0) - 1920);
        const rightDistance = Math.abs((right.width || 0) - 1920);
        return leftDistance - rightDistance;
      });
    const selected = files[0];
    return {
      id: `pexels-video-${video.id}`,
      provider: 'pexels',
      kind: 'video',
      title: `Vídeo de ${video.user?.name || 'Pexels'}`,
      previewUrl: safeHttps(video.image),
      downloadUrl: safeHttps(selected?.link),
      sourceUrl: safeHttps(video.url),
      author: video.user?.name || null,
      license: 'Pexels License',
      attribution: video.user?.name
        ? `Vídeo de ${video.user.name} en Pexels.`
        : 'Vídeo de Pexels.',
      width: Number(selected?.width) || null,
      height: Number(selected?.height) || null,
      durationSeconds: Number(video.duration) || null,
      imported: false
    };
  }).filter((item) => item.previewUrl && item.downloadUrl && item.sourceUrl);
}

export async function searchPixabay(query, {
  kind = 'image',
  limit = 18,
  apiKey = process.env.PIXABAY_API_KEY,
  fetchImpl = globalThis.fetch,
  signal,
  timeoutMs = 20_000
} = {}) {
  const wantedKind = cleanKind(kind);
  if (!['image', 'video'].includes(wantedKind) || !apiKey) return [];
  const url = new URL(
    wantedKind === 'video' ? PIXABAY_VIDEO_SEARCH : PIXABAY_PHOTO_SEARCH
  );
  url.searchParams.set('key', apiKey);
  url.searchParams.set('q', cleanQuery(query).slice(0, 100));
  url.searchParams.set('per_page', String(Math.max(3, Math.min(30, limit))));
  url.searchParams.set('safesearch', 'true');
  url.searchParams.set('order', 'popular');
  if (wantedKind === 'image') {
    url.searchParams.set('image_type', 'photo');
    url.searchParams.set('orientation', 'horizontal');
    url.searchParams.set('min_width', '1280');
    url.searchParams.set('min_height', '720');
  } else {
    url.searchParams.set('video_type', 'film');
    url.searchParams.set('min_width', '1280');
    url.searchParams.set('min_height', '720');
  }
  const response = await fetchWithTimeout(url, {}, {
    fetchImpl,
    signal,
    timeoutMs
  });
  if (!response.ok) {
    const error = new Error(`Pixabay respondió con HTTP ${response.status}.`);
    error.code = 'PIXABAY_SEARCH_FAILED';
    error.status = response.status === 429 ? 429 : 502;
    throw error;
  }
  const payload = await response.json();
  if (wantedKind === 'image') {
    return (payload.hits || []).map((photo) => ({
      id: `pixabay-photo-${photo.id}`,
      provider: 'pixabay',
      kind: 'image',
      title: photo.tags || `Fotografía de ${photo.user || 'Pixabay'}`,
      previewUrl: safeHttps(photo.webformatURL || photo.previewURL),
      downloadUrl: safeHttps(photo.fullHDURL || photo.largeImageURL),
      sourceUrl: safeHttps(photo.pageURL),
      author: photo.user || null,
      license: 'Pixabay Content License',
      attribution: photo.user
        ? `Imagen de ${photo.user} en Pixabay.`
        : 'Imagen de Pixabay.',
      width: Number(photo.imageWidth || photo.webformatWidth) || null,
      height: Number(photo.imageHeight || photo.webformatHeight) || null,
      durationSeconds: null,
      imported: false
    })).filter((item) =>
      item.previewUrl && item.downloadUrl && item.sourceUrl
    );
  }
  return (payload.hits || []).map((video) => {
    const variants = Object.values(video.videos || {})
      .filter((variant) => safeHttps(variant?.url))
      .sort((left, right) => {
        const leftDistance = Math.abs((left.width || 0) - 1920);
        const rightDistance = Math.abs((right.width || 0) - 1920);
        return leftDistance - rightDistance;
      });
    const selected = variants[0];
    return {
      id: `pixabay-video-${video.id}`,
      provider: 'pixabay',
      kind: 'video',
      title: video.tags || `Vídeo de ${video.user || 'Pixabay'}`,
      previewUrl: safeHttps(selected?.thumbnail),
      downloadUrl: safeHttps(selected?.url),
      sourceUrl: safeHttps(video.pageURL),
      author: video.user || null,
      license: 'Pixabay Content License',
      attribution: video.user
        ? `Vídeo de ${video.user} en Pixabay.`
        : 'Vídeo de Pixabay.',
      width: Number(selected?.width) || null,
      height: Number(selected?.height) || null,
      durationSeconds: Number(video.duration) || null,
      imported: false
    };
  }).filter((item) => item.previewUrl && item.downloadUrl && item.sourceUrl);
}

export async function searchBrandfetch(query, {
  limit = 18,
  clientId = process.env.BRANDFETCH_CLIENT_ID,
  fetchImpl = globalThis.fetch,
  signal,
  timeoutMs = 20_000
} = {}) {
  if (!clientId) return [];
  const url = new URL(`${BRANDFETCH_SEARCH}/${encodeURIComponent(cleanQuery(query))}`);
  url.searchParams.set('c', clientId);
  const response = await fetchWithTimeout(url, {}, {fetchImpl, signal, timeoutMs});
  if (!response.ok) {
    const error = new Error(`Brandfetch respondió con HTTP ${response.status}.`);
    error.code = 'BRANDFETCH_SEARCH_FAILED';
    error.status = response.status === 429 ? 429 : 502;
    throw error;
  }
  return (await response.json())
    .slice(0, Math.min(30, Math.max(1, limit)))
    .map((brand) => ({
      id: `brandfetch-${String(brand.brandId || brand.domain).replace(/[^a-zA-Z0-9-]/g, '-')}`,
      provider: 'brandfetch',
      kind: 'logo',
      title: brand.name || brand.domain,
      previewUrl: safeHttps(brand.icon),
      downloadUrl: safeHttps(brand.icon),
      sourceUrl: safeHttps(`https://${brand.domain}`),
      author: brand.name || null,
      license: 'Brand owner trademark; verify editorial use',
      attribution: 'Logo supplied by Brandfetch; no affiliation implied.',
      width: null,
      height: null,
      durationSeconds: null,
      imported: false,
      domain: brand.domain,
      claimed: brand.claimed === true
    }))
    .filter((item) => item.previewUrl && item.sourceUrl);
}

export async function searchEditorialAssets({
  query,
  kind = 'image',
  limit = 18
}, options = {}) {
  const clean = cleanQuery(query);
  const wantedKind = cleanKind(kind);
  const safeLimit = Math.min(30, Math.max(1, Number(limit) || 18));
  const env = options.env || process.env;
  const providers = {
    local: {configured: true},
    offlineLogos: {configured: true},
    pexels: {configured: Boolean(options.pexelsApiKey ?? env.PEXELS_API_KEY)},
    pixabay: {
      configured: Boolean(options.pixabayApiKey ?? env.PIXABAY_API_KEY)
    },
    brandfetch: {
      configured: Boolean(options.brandfetchClientId ?? env.BRANDFETCH_CLIENT_ID)
    }
  };
  const warnings = [];
  const local = await searchLocalEditorialAssets(clean, {
    kind: wantedKind,
    limit: safeLimit,
    catalogFile: options.catalogFile || DEFAULT_CATALOG
  });
  let remote = [];
  try {
    if (wantedKind === 'logo') {
      const offline = searchOfflineBrandLogos(clean, {limit: safeLimit});
      const brandfetch = await searchBrandfetch(clean, {
        limit: safeLimit,
        clientId: options.brandfetchClientId ?? env.BRANDFETCH_CLIENT_ID,
        fetchImpl: options.fetchImpl,
        signal: options.signal,
        timeoutMs: options.timeoutMs
      });
      remote = [...offline, ...brandfetch];
      if (!providers.brandfetch.configured) {
        warnings.push({
          code: 'BRANDFETCH_NOT_CONFIGURED',
          message: 'La búsqueda local de logos está activa; Brandfetch es opcional para ampliar resultados remotos.'
        });
      }
    } else {
      const remoteSearches = [
        {
          provider: 'pexels',
          configured: providers.pexels.configured,
          run: () => searchPexels(clean, {
            kind: wantedKind,
            limit: safeLimit,
            apiKey: options.pexelsApiKey ?? env.PEXELS_API_KEY,
            fetchImpl: options.fetchImpl,
            signal: options.signal,
            timeoutMs: options.timeoutMs
          })
        },
        {
          provider: 'pixabay',
          configured: providers.pixabay.configured,
          run: () => searchPixabay(clean, {
            kind: wantedKind,
            limit: safeLimit,
            apiKey: options.pixabayApiKey ?? env.PIXABAY_API_KEY,
            fetchImpl: options.fetchImpl,
            signal: options.signal,
            timeoutMs: options.timeoutMs
          })
        }
      ];
      const configuredSearches = remoteSearches.filter(
        (provider) => provider.configured
      );
      const settled = await Promise.allSettled(
        configuredSearches.map((provider) => provider.run())
      );
      const providerResults = settled.map((result, index) => {
        if (result.status === 'fulfilled') return result.value;
        const provider = configuredSearches[index];
        warnings.push({
          code: result.reason?.code || `${provider.provider.toUpperCase()}_SEARCH_FAILED`,
          message: `${provider.provider} no respondió; continúan disponibles los demás proveedores.`
        });
        return [];
      });
      remote = interleave(providerResults);
      if (!providers.pexels.configured) {
        warnings.push({
          code: 'PEXELS_NOT_CONFIGURED',
          message: 'Configura PEXELS_API_KEY para buscar imágenes y vídeos remotos.'
        });
      }
      if (!providers.pixabay.configured) {
        warnings.push({
          code: 'PIXABAY_NOT_CONFIGURED',
          message: 'Configura PIXABAY_API_KEY para ampliar la búsqueda de imágenes y vídeos.'
        });
      }
    }
  } catch (error) {
    warnings.push({
      code: error.code || 'ASSET_PROVIDER_FAILED',
      message: 'El proveedor remoto no respondió; se muestran los assets locales.'
    });
  }
  return {
    query: clean,
    kind: wantedKind,
    items: [...local, ...remote].slice(0, safeLimit),
    providers,
    warnings
  };
}

export const editorialAssetKinds = [...KINDS];
